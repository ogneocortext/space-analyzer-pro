use clap::{Parser, ValueEnum};
use headless_chrome::protocol::cdp::Page::{CaptureScreenshotFormatOption, Viewport};
use headless_chrome::{Browser, Tab};
use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, ValueEnum)]
enum DevicePreset {
    Mobile,
    Tablet,
    Desktop,
    Wide,
    Ultrawide,
    Custom,
}

#[derive(Debug, Clone, ValueEnum)]
enum ImageFormat {
    Png,
    Jpeg,
    Webp,
}

#[derive(Parser)]
#[command(
    author,
    version,
    about = "Advanced frontend design analysis screenshot tool",
    long_about = "Capture screenshots of web pages for design analysis with support for multiple viewports, dark mode, element selection, and batch processing."
)]
struct Args {
    /// URL to capture screenshot from (or file with URLs for batch mode)
    #[arg(default_value = "http://localhost:3000")]
    url: String,

    /// Device preset for viewport sizing
    #[arg(short, long, value_enum, default_value = "desktop")]
    device: DevicePreset,

    /// Output file path (or directory for batch mode)
    #[arg(short, long, default_value = "screenshot.png")]
    output: String,

    /// Image format
    #[arg(short, long, value_enum, default_value = "png")]
    format: ImageFormat,

    /// JPEG quality (0-100, only used with JPEG format)
    #[arg(long, default_value = "90")]
    quality: u8,

    /// Custom viewport width (overrides device preset)
    #[arg(long)]
    width: Option<u32>,

    /// Custom viewport height (overrides device preset)
    #[arg(long)]
    height: Option<u32>,

    /// Wait time in milliseconds after navigation
    #[arg(long, default_value = "1000")]
    wait: u64,

    /// Enable dark mode
    #[arg(long)]
    dark_mode: bool,

    /// Capture full page (scrolls to capture entire document)
    #[arg(long)]
    full_page: bool,

    /// CSS selector for element to capture
    #[arg(long)]
    selector: Option<String>,

    /// Enable 8px grid overlay
    #[arg(long)]
    grid: bool,

    /// Enable baseline grid overlay
    #[arg(long)]
    baseline: bool,

    /// Show Core Web Vitals metrics
    #[arg(long)]
    metrics: bool,

    /// Run accessibility checks
    #[arg(long)]
    a11y: bool,

    /// Compare multiple viewports (mobile, tablet, desktop)
    #[arg(long)]
    compare: bool,

    /// Batch mode - read URLs from file
    #[arg(long)]
    batch: bool,

    /// Screenshot delay between captures in batch mode (ms)
    #[arg(long, default_value = "500")]
    delay: u64,

    /// Silent mode (suppress output)
    #[arg(short, long)]
    silent: bool,
}

fn get_viewport_size(device: &DevicePreset, custom_width: Option<u32>, custom_height: Option<u32>) -> (u32, u32) {
    let (w, h) = match device {
        DevicePreset::Mobile => (375, 667),      // iPhone SE
        DevicePreset::Tablet => (768, 1024),     // iPad
        DevicePreset::Desktop => (1920, 1080), // Full HD
        DevicePreset::Wide => (2560, 1440),    // QHD
        DevicePreset::Ultrawide => (3440, 1440), // Ultrawide
        DevicePreset::Custom => (custom_width.unwrap_or(1920), custom_height.unwrap_or(1080)),
    };
    (custom_width.unwrap_or(w), custom_height.unwrap_or(h))
}

fn format_to_enum(format: &ImageFormat) -> CaptureScreenshotFormatOption {
    match format {
        ImageFormat::Png => CaptureScreenshotFormatOption::Png,
        ImageFormat::Jpeg => CaptureScreenshotFormatOption::Jpeg,
        ImageFormat::Webp => CaptureScreenshotFormatOption::Webp,
    }
}

fn get_extension(format: &ImageFormat) -> &'static str {
    match format {
        ImageFormat::Png => "png",
        ImageFormat::Jpeg => "jpg",
        ImageFormat::Webp => "webp",
    }
}

fn inject_dark_mode(tab: &Tab) -> Result<(), Box<dyn Error>> {
    tab.evaluate(r#"
        document.documentElement.style.setProperty('color-scheme', 'dark');
        document.body.style.setProperty('background-color', '#1a1a1a');
        const style = document.createElement('style');
        style.textContent = `
            * { color-scheme: dark !important; }
            body { background: #1a1a1a !important; color: #ffffff !important; }
        `;
        document.head.appendChild(style);
        "dark mode enabled"
    "#, false)?;
    Ok(())
}

fn inject_grid_overlay(tab: &Tab, grid_size: u32) -> Result<(), Box<dyn Error>> {
    let script = format!(r#"
        const existing = document.getElementById('design-grid-overlay');
        if (existing) existing.remove();

        const grid = document.createElement('div');
        grid.id = 'design-grid-overlay';
        grid.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999999;
            background-image:
                linear-gradient(to right, rgba(255,0,0,0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,0,0,0.1) 1px, transparent 1px);
            background-size: {}px {}px;
        `;
        document.body.appendChild(grid);
        "grid overlay added"
    "#, grid_size, grid_size);
    tab.evaluate(&script, false)?;
    Ok(())
}

fn inject_baseline_grid(tab: &Tab) -> Result<(), Box<dyn Error>> {
    tab.evaluate(r#"
        const existing = document.getElementById('baseline-grid-overlay');
        if (existing) existing.remove();

        const grid = document.createElement('div');
        grid.id = 'baseline-grid-overlay';
        grid.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999998;
            background-image: repeating-linear-gradient(
                to bottom,
                transparent,
                transparent 23px,
                rgba(0,100,255,0.1) 23px,
                rgba(0,100,255,0.1) 24px
            );
        `;
        document.body.appendChild(grid);
        "baseline grid added"
    "#, false)?;
    Ok(())
}

fn analyze_page_content(tab: &Tab) -> Result<Vec<String>, Box<dyn Error>> {
    // First, wait a bit for Vue/React components to render
    tab.evaluate(r#"
        new Promise(resolve => setTimeout(resolve, 500))
    "#, false)?;

    let result = tab.evaluate(r#"
        JSON.stringify((function() {
            const analysis = [];

            // Page title/heading - check all h1 elements for Vue components
            let pageTitle = null;
            // Try to find the best h1 (not in sidebar/header, with actual content)
            const allH1s = document.querySelectorAll('h1');
            let bestH1 = null;
            let maxLength = 0;
            for (const h1 of allH1s) {
                // Skip if in sidebar or header nav
                if (h1.closest('[class*="sidebar"]') || h1.closest('[class*="sidenav"]') || h1.closest('nav')) {
                    continue;
                }
                const text = h1.textContent ? h1.textContent.trim() : '';
                if (text.length > maxLength && text.length > 3) {
                    maxLength = text.length;
                    bestH1 = h1;
                }
            }
            if (bestH1) {
                pageTitle = bestH1.textContent.trim();
            }
            // Fallback to document title
            if (!pageTitle) {
                pageTitle = document.title;
            }
            analysis.push(`[PAGE] Title: "${pageTitle}"`);

            // Detect navigation breadcrumbs
            let breadcrumbs = null;

            // Method 1: Look for aria-label
            breadcrumbs = document.querySelector('nav[aria-label*="breadcrumb" i], [aria-label*="breadcrumb" i]');

            // Method 2: Look for nav elements that:
            // - Aren't in sidebar
            // - Have short text (<50 chars)
            // - Contain "Dashboard" or common breadcrumb patterns
            if (!breadcrumbs) {
                document.querySelectorAll('nav').forEach(nav => {
                    if (!breadcrumbs &&
                        !nav.closest('[class*="sidebar"]') &&
                        !nav.closest('[class*="sidenav"]')) {
                        const text = nav.textContent.trim();
                        // Breadcrumbs typically: short, contain "Dashboard" or similar, have 2-6 words
                        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
                        const hasBreadcrumbPattern = text.match(/Dashboard|Home|Main/i) && wordCount <= 6;
                        if (text.length < 80 && hasBreadcrumbPattern) {
                            breadcrumbs = nav;
                        }
                    }
                });
            }

            // Method 3: Look for any element with breadcrumb class
            if (!breadcrumbs) {
                document.querySelectorAll('[class*="breadcrumb"]').forEach(el => {
                    if (!breadcrumbs &&
                        !el.closest('[class*="sidebar"]') &&
                        !el.closest('[class*="sidenav"]')) {
                        breadcrumbs = el;
                    }
                });
            }

            if (breadcrumbs) {
                let crumbText = breadcrumbs.textContent.trim().replace(/\s+/g, ' ').slice(0, 100);

                // Try to extract all link/text elements to build proper breadcrumb
                const crumbParts = [];
                breadcrumbs.querySelectorAll('a, span, [class*="current"], [class*="active"]').forEach(el => {
                    const text = el.textContent.trim();
                    if (text && text.length > 0 && text.length < 50) {
                        crumbParts.push(text);
                    }
                });

                // If we found structured parts, use those
                if (crumbParts.length >= 2) {
                    crumbText = crumbParts.join(' > ');
                } else {
                    // Clean up common patterns: "Dashboard Reports" -> "Dashboard > Reports"
                    if (crumbText.match(/Dashboard\s+\w+/i) && !crumbText.includes('>')) {
                        crumbText = crumbText.replace(/(Dashboard)\s+(\w+)/i, '$1 > $2');
                    }
                }

                // Also count breadcrumb items
                const itemCount = breadcrumbs.querySelectorAll('a, li, span').length;
                analysis.push(`[NAVIGATION] Breadcrumbs (${itemCount} items): "${crumbText}"`);
            }

            // Detect active/selected nav item
            const activeNav = document.querySelector('.active, [class*="selected"], [class*="current"]');
            if (activeNav) {
                analysis.push(`[NAVIGATION] Active section: "${activeNav.textContent.trim().slice(0, 50)}"`);
            }

            // Empty state detection - look for empty containers with text
            const emptyStates = [];
            // Look for empty state containers
            document.querySelectorAll('[class*="empty"], [class*="no-data"], [class*="placeholder"]').forEach(el => {
                const text = el.textContent.trim();
                if (text && text.length > 10) {
                    emptyStates.push(text.slice(0, 150));
                }
            });
            // Also detect any container with "No" followed by content (like "No Analysis Available")
            document.querySelectorAll('div, section, article').forEach(el => {
                const text = el.textContent.trim();
                if (text.match(/No\s+\w+.*(yet|available|found|data)/i) && text.length < 200) {
                    // Avoid duplicates
                    const alreadyFound = emptyStates.some(es => es.includes(text.slice(0, 30)));
                    if (!alreadyFound) {
                        emptyStates.push(text.slice(0, 150));
                    }
                }
            });
            if (emptyStates.length > 0) {
                analysis.push(`[CONTENT] Empty states detected: ${emptyStates.length}`);
                emptyStates.slice(0, 3).forEach((text, i) => {
                    analysis.push(`  ${i+1}. "${text}"`);
                });
            }

            // Warning/error/info messages - look for alert containers or prominent text
            const alerts = [];
            // Check for alert-styled containers
            document.querySelectorAll('[class*="warning"], [class*="alert"], [class*="error"], [class*="info"], [class*="success"], [class*="notice"], [class*="message"]').forEach(el => {
                const icon = el.querySelector('svg, i, .icon, [class*="icon"], [class*="emoji"]');
                const iconText = icon ? ' (with icon)' : '';
                const text = el.textContent.trim().slice(0, 100);
                if (text && text.length > 5 && !alerts.find(a => a.includes(text.slice(0, 30)))) {
                    alerts.push(`"${text}"${iconText}`);
                }
            });
            // Also look for text containing warning indicators
            document.querySelectorAll('div, p, span').forEach(el => {
                const text = el.textContent.trim();
                if (text.match(/⚠️|⚠|🚨|❗|❌|✅|ℹ️|📝|📊|📄/) && text.length > 10 && text.length < 150) {
                    const alreadyFound = alerts.some(a => a.includes(text.slice(0, 30)));
                    if (!alreadyFound) {
                        alerts.push(`"${text}" (emoji indicator)`);
                    }
                }
            });
            if (alerts.length > 0) {
                analysis.push(`[ALERTS] Messages/banners found: ${alerts.length}`);
                alerts.slice(0, 4).forEach((alert, i) => {
                    analysis.push(`  ${i+1}. ${alert}`);
                });
            }

            // Section/Card headers detection
            const sections = [];
            document.querySelectorAll('h2, h3, h4, [class*="header"], [class*="title"], [class*="heading"]').forEach(el => {
                const text = el.textContent.trim();
                if (text && text.length > 2 && text.length < 100) {
                    // Avoid duplicates
                    if (!sections.find(s => s.toLowerCase() === text.toLowerCase())) {
                        sections.push(text);
                    }
                }
            });
            if (sections.length > 0) {
                analysis.push(`[SECTIONS] Page sections: ${sections.length}`);
                sections.slice(0, 6).forEach((text, i) => {
                    analysis.push(`  ${i+1}. "${text}"`);
                });
            }

            // Button analysis
            const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]');
            const buttonTexts = [];
            const disabledButtons = [];
            buttons.forEach(btn => {
                const text = btn.textContent.trim() || btn.value || btn.getAttribute('aria-label') || 'unnamed';
                const isDisabled = btn.disabled || btn.getAttribute('disabled') || btn.classList.contains('disabled');
                if (isDisabled) {
                    disabledButtons.push(text.slice(0, 30));
                } else {
                    buttonTexts.push(text.slice(0, 30));
                }
            });
            analysis.push(`[BUTTONS] ${buttons.length} found (${disabledButtons.length} disabled)`);
            buttonTexts.slice(0, 5).forEach((text, i) => {
                analysis.push(`  ${i+1}. "${text}"${disabledButtons.includes(text) ? ' [disabled]' : ''}`);
            });

            // Form detection
            const forms = document.querySelectorAll('form');
            const inputs = document.querySelectorAll('input, select, textarea');
            if (forms.length > 0 || inputs.length > 0) {
                analysis.push(`[FORMS] ${forms.length} forms, ${inputs.length} inputs`);
            }

            // Card/section detection
            const cards = document.querySelectorAll('[class*="card"], [class*="panel"], [class*="section"], [class*="box"]');
            if (cards.length > 0) {
                analysis.push(`[LAYOUT] ${cards.length} card/panel elements`);
            }

            // Table detection
            const tables = document.querySelectorAll('table');
            if (tables.length > 0) {
                const rows = tables[0].querySelectorAll('tr').length;
                analysis.push(`[DATA] ${tables.length} table(s) with ~${rows} rows`);
            }

            // List detection
            const lists = document.querySelectorAll('ul, ol');
            if (lists.length > 0) {
                let totalItems = 0;
                lists.forEach(l => totalItems += l.querySelectorAll('li').length);
                analysis.push(`[LISTS] ${lists.length} lists with ${totalItems} total items`);
            }

            // Image detection (with alt)
            const images = document.querySelectorAll('img');
            const withAlt = document.querySelectorAll('img[alt]');
            if (images.length > 0) {
                analysis.push(`[IMAGES] ${images.length} images (${withAlt.length} with alt text)`);
            }

            // Modal/overlay detection
            const modals = document.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="dialog"], [role="dialog"]');
            const visibleModals = Array.from(modals).filter(m => {
                const style = window.getComputedStyle(m);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
            if (visibleModals.length > 0) {
                analysis.push(`[MODAL] ${visibleModals.length} visible dialog/overlay(s)`);
            }

            // Loading states
            const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="skeleton"]');
            if (loadingElements.length > 0) {
                analysis.push(`[STATE] ${loadingElements.length} loading indicator(s) visible`);
            }

            // Sidebar detection
            const sidebar = document.querySelector('[class*="sidebar"], [class*="sidenav"], aside');
            if (sidebar) {
                const navItems = sidebar.querySelectorAll('a, button, [role="button"]').length;
                analysis.push(`[LAYOUT] Sidebar with ${navItems} navigation items`);
            }

            return analysis;
        })())
    "#, false)?;

    let mut content_analysis = Vec::new();

    if let Some(value) = result.value {
        if let Some(json_str) = value.as_str() {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                if let Some(arr) = parsed.as_array() {
                    for item in arr {
                        if let Some(s) = item.as_str() {
                            content_analysis.push(s.to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(content_analysis)
}

fn run_accessibility_checks(tab: &Tab) -> Result<Vec<String>, Box<dyn Error>> {
    let result = tab.evaluate(r#"
        JSON.stringify((function() {
            const issues = [];
            const colorIssues = [];

            // Helper: Parse RGB values
            function parseRGB(colorStr) {
                const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (!match) return null;
                return {
                    r: parseInt(match[1]),
                    g: parseInt(match[2]),
                    b: parseInt(match[3])
                };
            }

            // Helper: Calculate relative luminance (WCAG formula)
            function getLuminance(rgb) {
                const rsRGB = rgb.r / 255;
                const gsRGB = rgb.g / 255;
                const bsRGB = rgb.b / 255;
                const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
                const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
                const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            }

            // Helper: Calculate contrast ratio
            function getContrastRatio(rgb1, rgb2) {
                const lum1 = getLuminance(rgb1);
                const lum2 = getLuminance(rgb2);
                const lighter = Math.max(lum1, lum2);
                const darker = Math.min(lum1, lum2);
                return (lighter + 0.05) / (darker + 0.05);
            }

            // Helper: Get effective background color (traverses up DOM)
            function getEffectiveBackground(el) {
                let current = el;
                while (current && current !== document.body) {
                    const style = window.getComputedStyle(current);
                    const bg = style.backgroundColor;
                    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                        return bg;
                    }
                    current = current.parentElement;
                }
                // Default to white or body background
                const bodyBg = window.getComputedStyle(document.body).backgroundColor;
                return (bodyBg && bodyBg !== 'transparent') ? bodyBg : 'rgb(255, 255, 255)';
            }

            // Helper: Check colorblind-friendly combinations
            function isColorblindFriendly(rgb1, rgb2) {
                // Check for red-green combinations (protanopia/deuteranopia)
                const r1 = rgb1.r, g1 = rgb1.g, b1 = rgb1.b;
                const r2 = rgb2.r, g2 = rgb2.g, b2 = rgb2.b;

                // Red-green similarity check
                const redGreenSimilar1 = Math.abs(r1 - g1) < 50;
                const redGreenSimilar2 = Math.abs(r2 - g2) < 50;

                if (redGreenSimilar1 && redGreenSimilar2) {
                    // Check if they're distinguishable by brightness
                    const lum1 = getLuminance(rgb1);
                    const lum2 = getLuminance(rgb2);
                    return Math.abs(lum1 - lum2) > 0.2;
                }
                return true;
            }

            // COLOR ANALYSIS
            const colorStats = {
                totalElements: 0,
                aaPass: 0,
                aaFail: 0,
                aaaPass: 0,
                colorblindIssues: 0,
                smallTextIssues: 0,
                largeTextIssues: 0
            };

            // Extract all unique colors used
            const colorsUsed = new Set();
            const textElements = [];

            // Check all text elements for contrast
            document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button, label, li').forEach((el) => {
                const style = window.getComputedStyle(el);
                const color = style.color;
                const bg = getEffectiveBackground(el);
                const fontSize = parseFloat(style.fontSize);
                const fontWeight = style.fontWeight;
                const isBold = fontWeight === 'bold' || fontWeight === '700' || parseInt(fontWeight) >= 700;
                const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);

                const fgRGB = parseRGB(color);
                const bgRGB = parseRGB(bg);

                if (fgRGB && bgRGB) {
                    colorsUsed.add(color);
                    colorsUsed.add(bg);
                    colorStats.totalElements++;

                    const ratio = getContrastRatio(fgRGB, bgRGB);
                    const aaThreshold = isLargeText ? 3.0 : 4.5;
                    const aaaThreshold = isLargeText ? 4.5 : 7.0;

                    // Store for analysis
                    textElements.push({
                        tag: el.tagName,
                        text: el.textContent?.slice(0, 50) || '',
                        ratio: ratio,
                        fg: color,
                        bg: bg,
                        fontSize: fontSize,
                        isLarge: isLargeText
                    });

                    if (ratio >= aaThreshold) {
                        colorStats.aaPass++;
                    } else {
                        colorStats.aaFail++;
                        if (isLargeText) {
                            colorStats.largeTextIssues++;
                        } else {
                            colorStats.smallTextIssues++;
                        }
                        // Add visual indicator
                        if (colorIssues.length < 5) {
                            el.style.outline = '2px dashed red';
                            colorIssues.push(`${el.tagName}: ${ratio.toFixed(2)}:1 contrast (needs ${aaThreshold}:1) - "${el.textContent?.slice(0, 30)}..."`);
                        }
                    }

                    if (ratio >= aaaThreshold) {
                        colorStats.aaaPass++;
                    }

                    // Check colorblind issues
                    if (!isColorblindFriendly(fgRGB, bgRGB) && ratio < 4.5) {
                        colorStats.colorblindIssues++;
                    }
                }
            });

            // Find worst contrast offenders
            const worstOffenders = textElements
                .filter(e => e.ratio < 4.5 && !e.isLarge)
                .sort((a, b) => a.ratio - b.ratio)
                .slice(0, 3);

            // Analyze color palette
            const palette = Array.from(colorsUsed).slice(0, 10);
            const darkColors = palette.filter(c => {
                const rgb = parseRGB(c);
                return rgb && getLuminance(rgb) < 0.5;
            });
            const lightColors = palette.filter(c => {
                const rgb = parseRGB(c);
                return rgb && getLuminance(rgb) >= 0.5;
            });

            // Check for color-only indicators (no text/icons)
            document.querySelectorAll('.status, .indicator, .badge, [class*="color"]').forEach(el => {
                const text = el.textContent?.trim();
                const hasIcon = el.querySelector('svg, i, .icon') !== null;
                const hasAriaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
                const style = window.getComputedStyle(el);
                const bg = style.backgroundColor;

                if (!text && !hasIcon && !hasAriaLabel && bg && bg !== 'transparent') {
                    if (issues.length < 5) {
                        el.style.outline = '2px dotted orange';
                        issues.push(`Color-only indicator (no text/icon): ${el.className?.slice(0, 30) || el.tagName}`);
                    }
                }
            });

            // Check images without alt
            document.querySelectorAll('img:not([alt])').forEach((img, i) => {
                if (i < 3) img.style.outline = '3px solid red';
                issues.push('Image missing alt: ' + (img.src?.split('/').pop() || 'unknown'));
            });

            // Check form labels
            document.querySelectorAll('input:not([aria-label]):not([aria-labelledby]):not([placeholder]):not([id])').forEach((input, i) => {
                if (i < 3) input.style.outline = '3px solid purple';
                issues.push('Input missing label: ' + input.type);
            });

            // Build color analysis summary
            const colorReport = [];
            colorReport.push(`[COLOR ANALYSIS] Analyzed ${colorStats.totalElements} text elements`);
            colorReport.push(`[COLOR ANALYSIS] WCAG AA Pass: ${colorStats.aaPass}/${colorStats.totalElements} (${Math.round(colorStats.aaPass/colorStats.totalElements*100)}%)`);
            colorReport.push(`[COLOR ANALYSIS] WCAG AAA Pass: ${colorStats.aaaPass}/${colorStats.totalElements} (${Math.round(colorStats.aaaPass/colorStats.totalElements*100)}%)`);

            if (colorStats.aaFail > 0) {
                colorReport.push(`[COLOR ISSUE] ${colorStats.aaFail} elements fail WCAG AA contrast (${colorStats.smallTextIssues} small text, ${colorStats.largeTextIssues} large text)`);
            }

            if (colorStats.colorblindIssues > 0) {
                colorReport.push(`[COLOR ISSUE] ${colorStats.colorblindIssues} elements may be problematic for colorblind users`);
            }

            if (worstOffenders.length > 0) {
                colorReport.push(`[COLOR ISSUE] Worst contrast offenders:`);
                worstOffenders.forEach((el, i) => {
                    colorReport.push(`  ${i+1}. ${el.tag}: ${el.ratio.toFixed(2)}:1 - "${el.text.slice(0, 40)}..."`);
                });
            }

            colorReport.push(`[COLOR PALETTE] ${palette.length} unique colors used (${darkColors.length} dark, ${lightColors.length} light)`);

            return {
                issues: issues.slice(0, 8),
                colorIssues: colorIssues.slice(0, 5),
                colorReport: colorReport
            };
        })())
    "#, false)?;

    let mut all_issues = Vec::new();

    if let Some(value) = result.value {
        if let Some(json_str) = value.as_str() {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                // Add color report first
                if let Some(report) = parsed.get("colorReport") {
                    if let Some(arr) = report.as_array() {
                        for item in arr {
                            if let Some(s) = item.as_str() {
                                all_issues.push(s.to_string());
                            }
                        }
                    }
                }
                // Add color-specific issues
                if let Some(color_issues) = parsed.get("colorIssues") {
                    if let Some(arr) = color_issues.as_array() {
                        for item in arr {
                            if let Some(s) = item.as_str() {
                                all_issues.push(format!("[CONTRAST] {}", s));
                            }
                        }
                    }
                }
                // Add general accessibility issues
                if let Some(issues) = parsed.get("issues") {
                    if let Some(arr) = issues.as_array() {
                        for item in arr {
                            if let Some(s) = item.as_str() {
                                all_issues.push(s.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(all_issues)
}

fn get_performance_metrics(tab: &Tab) -> Result<HashMap<String, f64>, Box<dyn Error>> {
    // Build metrics based on what's available - use JSON.stringify for reliable transfer
    let result = tab.evaluate(r#"
        JSON.stringify((function() {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            const paints = performance.getEntriesByType('paint');

            let m = {};
            m.resourceCount = resources.length;
            m.paintCount = paints.length;
            m.navAvailable = nav ? 1 : 0;

            if (nav) {
                m.ttfb = nav.responseStart - nav.startTime;
                m.loadTime = nav.loadEventEnd - nav.startTime;
            }

            if (resources.length > 0) {
                let totalSize = 0;
                let totalTime = 0;
                let maxTime = 0;
                let largeCount = 0;
                for (let i = 0; i < resources.length; i++) {
                    const r = resources[i];
                    totalSize += r.transferSize || 0;
                    totalTime += r.duration || 0;
                    maxTime = Math.max(maxTime, r.duration || 0);
                    if (r.transferSize > 100 * 1024) largeCount++;
                }
                m.totalResourceSize = totalSize;
                m.totalResourceTime = totalTime;
                m.slowestResource = maxTime;
                m.largeResourceCount = largeCount;
            }

            // DOM stats
            m.domNodes = document.querySelectorAll('*').length;
            m.imageCount = document.querySelectorAll('img').length;

            // Vite detection
            m.viteDetected = (window.__VITE_IS_MODERN__ ||
                !!document.querySelector('script[data-vite-dev-id]')) ? 1 : 0;

            return m;
        })())
    "#, false)?;

    let mut metrics = HashMap::new();

    // Parse JSON string result
    if let Some(value) = result.value {
        if let Some(json_str) = value.as_str() {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                if let Some(obj) = parsed.as_object() {
                    for (k, v) in obj {
                        if let Some(num) = v.as_f64() {
                            metrics.insert(k.clone(), num);
                        }
                    }
                }
            }
        }
    }

    Ok(metrics)
}

fn get_full_page_dimensions(tab: &Tab) -> Result<(f64, f64), Box<dyn Error>> {
    let result = tab.evaluate(r#"
        JSON.stringify({
            width: Math.max(
                document.body.scrollWidth,
                document.documentElement.scrollWidth,
                document.body.offsetWidth,
                document.documentElement.offsetWidth
            ),
            height: Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.offsetHeight,
                document.documentElement.offsetHeight
            )
        })
    "#, false)?;

    let json_str = result.value.and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "{\"width\":1920,\"height\":1080}".to_string());
    let dims: serde_json::Value = serde_json::from_str(&json_str)?;

    let width = dims["width"].as_f64().unwrap_or(1920.0);
    let height = dims["height"].as_f64().unwrap_or(1080.0);

    Ok((width, height))
}

fn capture_screenshot(
    tab: &Tab,
    args: &Args,
    output_path: &Path,
) -> Result<(Vec<u8>, Option<HashMap<String, f64>>, Option<Vec<String>>, Option<Vec<String>>), Box<dyn Error>> {
    // Apply dark mode if enabled
    if args.dark_mode {
        inject_dark_mode(tab)?;
        std::thread::sleep(Duration::from_millis(200));
    }

    // Apply grid overlays
    if args.grid {
        inject_grid_overlay(tab, 8)?;
    }
    if args.baseline {
        inject_baseline_grid(tab)?;
    }

    // Get metrics if requested
    let metrics = if args.metrics {
        Some(get_performance_metrics(tab)?)
    } else {
        None
    };

    // Run accessibility checks
    let a11y_issues = if args.a11y {
        Some(run_accessibility_checks(tab)?)
    } else {
        None
    };

    // Analyze page content
    let content_analysis = if args.a11y {
        Some(analyze_page_content(tab)?)
    } else {
        None
    };

    // Handle full page capture
    let clip = if args.full_page && !args.selector.is_some() {
        let (width, height) = get_full_page_dimensions(tab)?;
        Some(headless_chrome::protocol::cdp::Page::Viewport {
            x: 0.0,
            y: 0.0,
            width,
            height,
            scale: 1.0,
        })
    } else {
        None
    };

    // Capture screenshot
    let format = format_to_enum(&args.format);
    let data = tab.capture_screenshot(
        format,
        if args.quality < 100 { Some(args.quality as u32) } else { None },
        clip,
        !args.full_page, // from_surface = false for full page
    )?;

    Ok((data, metrics, a11y_issues, content_analysis))
}

fn process_single_url_with_tab(
    tab: &Tab,
    url: &str,
    output: &Path,
    args: &Args,
) -> Result<(HashMap<String, f64>, Vec<String>, Vec<String>), Box<dyn Error>> {
    // Get viewport size
    let (width, height) = get_viewport_size(&args.device, args.width, args.height);

    // Set viewport
    let bounds = headless_chrome::types::Bounds::Normal {
        left: Some(0),
        top: Some(0),
        width: Some(width as f64),
        height: Some(height as f64),
    };
    tab.set_bounds(bounds)?;

    // Navigate
    if !args.silent {
        println!("Navigating to {}...", url);
    }
    tab.navigate_to(url)?;
    tab.wait_until_navigated()?;

    // Wait for dynamic content
    std::thread::sleep(Duration::from_millis(args.wait));

    // Get performance metrics after resources have loaded
    let metrics = if args.metrics {
        match get_performance_metrics(tab) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("Warning: Failed to collect metrics: {}", e);
                HashMap::new()
            }
        }
    } else {
        HashMap::new()
    };

    // Handle element-specific capture
    if let Some(selector) = &args.selector {
        tab.wait_for_element(selector)?;
    }

    // Capture
    if !args.silent {
        println!("Capturing screenshot ({}x{})...", width, height);
    }
    let (data, _, a11y_issues, content_analysis) = capture_screenshot(&tab, args, output)?;

    // Save
    fs::write(output, &data)?;

    if !args.silent {
        let file_size = data.len();
        let size_str = if file_size > 1024 * 1024 {
            format!("{:.2} MB", file_size as f64 / (1024.0 * 1024.0))
        } else if file_size > 1024 {
            format!("{:.2} KB", file_size as f64 / 1024.0)
        } else {
            format!("{} bytes", file_size)
        };
        println!("Saved: {} ({})", output.display(), size_str);

        if !metrics.is_empty() {
            let used_synthetic = metrics.get("usedSynthetic").unwrap_or(&0.0) > &0.0;
            let mut has_core_metrics = false;

            if used_synthetic {
                println!("Performance Metrics (Synthetic - localhost/Vite detected):");
            } else {
                println!("Performance Metrics:");
            }

            // Core Web Vitals
            if let Some(ttfb) = metrics.get("ttfb") {
                if *ttfb > 0.0 {
                    println!("  TTFB: {:.0}ms", ttfb);
                    has_core_metrics = true;
                }
            }
            if let Some(fcp) = metrics.get("fcp") {
                if *fcp > 0.0 {
                    println!("  FCP: {:.0}ms", fcp);
                    has_core_metrics = true;
                }
            }
            if let Some(lcp) = metrics.get("lcp") {
                if *lcp > 0.0 {
                    println!("  LCP: {:.0}ms", lcp);
                    has_core_metrics = true;
                }
            }
            if let Some(load_time) = metrics.get("loadTime") {
                if *load_time > 0.0 {
                    println!("  Load Time: {:.0}ms", load_time);
                    has_core_metrics = true;
                }
            }
            // Show synthetic fallback if no real metrics
            if !has_core_metrics {
                if let Some(synthetic_load) = metrics.get("syntheticLoad") {
                    println!("  Synthetic Load: {:.0}ms", synthetic_load);
                }
                if let Some(synthetic_ttfb) = metrics.get("syntheticTtfb") {
                    println!("  Estimated TTFB: {:.0}ms", synthetic_ttfb);
                }
            }

            // Resource Analysis
            if let Some(count) = metrics.get("resourceCount") {
                if *count > 0.0 {
                    println!("\nResource Analysis:");
                    println!("  Total Resources: {:.0}", count);

                    if let Some(size) = metrics.get("totalResourceSize") {
                        let size_kb = *size / 1024.0;
                        if size_kb > 1024.0 {
                            println!("  Total Size: {:.2} MB", size_kb / 1024.0);
                        } else {
                            println!("  Total Size: {:.0} KB", size_kb);
                        }
                    }

                    if let Some(time) = metrics.get("totalResourceTime") {
                        if *time > 0.0 {
                            println!("  Resource Load Time: {:.0}ms", time);
                        }
                    }

                    if let Some(slowest) = metrics.get("slowestResource") {
                        if *slowest > 0.0 {
                            println!("  Slowest Resource: {:.0}ms", slowest);
                        }
                    }

                    if let Some(large) = metrics.get("largeResourceCount") {
                        if *large > 0.0 {
                            println!("  Large Resources (>100KB): {:.0}", large);
                        }
                    }
                }
            }

            // JavaScript Analysis
            if let Some(js_count) = metrics.get("jsResourceCount") {
                if *js_count > 0.0 {
                    println!("\nJavaScript:");
                    println!("  JS Files: {:.0}", js_count);
                    if let Some(js_time) = metrics.get("jsExecutionTime") {
                        if *js_time > 0.0 {
                            println!("  JS Load Time: {:.0}ms", js_time);
                        }
                    }
                }
            }

            // CSS Analysis
            if let Some(css_count) = metrics.get("cssCount") {
                if *css_count > 0.0 {
                    println!("\nStylesheets:");
                    println!("  CSS Files: {:.0}", css_count);
                    if let Some(css_time) = metrics.get("cssLoadTime") {
                        if *css_time > 0.0 {
                            println!("  CSS Load Time: {:.0}ms", css_time);
                        }
                    }
                }
            }

            // Image Analysis
            if let Some(img_count) = metrics.get("imageCount") {
                if *img_count > 0.0 {
                    println!("\nImages:");
                    println!("  Total: {:.0}", img_count);
                    if let Some(unopt) = metrics.get("unoptimizedImages") {
                        if *unopt > 0.0 {
                            println!("  Oversized (>2x display): {:.0}", unopt);
                        }
                    }
                }
            }

            // DOM Complexity
            if let Some(nodes) = metrics.get("domNodes") {
                println!("\nDOM Complexity:");
                println!("  Total Nodes: {:.0}", nodes);
                if let Some(depth) = metrics.get("domDepth") {
                    println!("  Max Depth: {:.0}", depth);
                }
            }

            // Vite Detection
            if let Some(vite) = metrics.get("viteDetected") {
                if *vite > 0.0 {
                    println!("\n[Vite Dev Server Detected]");
                }
            }

            // Render Blocking
            if let Some(blocking) = metrics.get("blockingResourceCount") {
                if *blocking > 0.0 {
                    println!("\nRender Blocking Resources: {:.0}", blocking);
                }
            }
        }

        // Print content analysis first
        if let Some(analysis) = &content_analysis {
            if !analysis.is_empty() {
                println!("\n📄 Page Content Analysis:");
                for item in analysis {
                    println!("  {}", item);
                }
            }
        }

        if let Some(issues) = &a11y_issues {
            if !issues.is_empty() {
                println!("\n♿ Accessibility Issues (first 10):");
                for issue in issues {
                    println!("  - {}", issue);
                }
            } else {
                println!("\n✓ No major accessibility issues found.");
            }
        }
    }

    Ok((metrics, a11y_issues.unwrap_or_default(), content_analysis.unwrap_or_default()))
}

fn process_single_url(
    browser: &Browser,
    url: &str,
    output: &Path,
    args: &Args,
) -> Result<(), Box<dyn Error>> {
    let tab = browser.new_tab()?;
    process_single_url_with_tab(&tab, url, output, args)?;
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let start_time = Instant::now();

    if !args.silent {
        println!("Design Screenshot Tool");
        println!("======================");
    }

    // Batch mode
    if args.batch {
        let urls_content = fs::read_to_string(&args.url)?;
        let urls: Vec<&str> = urls_content.lines().filter(|l| !l.is_empty()).collect();

        let output_dir = Path::new(&args.output);
        if !output_dir.exists() {
            fs::create_dir_all(output_dir)?;
        }

        let browser = Browser::default()?;

        for (i, url) in urls.iter().enumerate() {
            if !args.silent {
                println!("\n[{}/{}] Processing {}", i + 1, urls.len(), url);
            }

            let filename = format!("screenshot_{:03}.{}", i + 1, get_extension(&args.format));
            let output_path = output_dir.join(filename);

            if let Err(e) = process_single_url(&browser, url, &output_path, &args) {
                eprintln!("Error processing {}: {}", url, e);
            }

            if i < urls.len() - 1 {
                std::thread::sleep(Duration::from_millis(args.delay));
            }
        }

        if !args.silent {
            println!("\nBatch complete: {} screenshots saved to {}", urls.len(), output_dir.display());
        }
        return Ok(());
    }

    // Comparison mode - capture multiple viewports
    if args.compare {
        let devices = vec![
            (DevicePreset::Mobile, "mobile"),
            (DevicePreset::Tablet, "tablet"),
            (DevicePreset::Desktop, "desktop"),
        ];

        let browser = Browser::default()?;
        let base_output = Path::new(&args.output);
        let stem = base_output.file_stem().unwrap_or_default().to_str().unwrap_or("screenshot");
        let parent = base_output.parent().unwrap_or(Path::new("."));

        let mut all_metrics: HashMap<String, Vec<HashMap<String, f64>>> = HashMap::new();

        for (device, name) in &devices {
            let mut device_args = args.clone();
            device_args.device = device.clone();

            let filename = format!("{}_{}.{}", stem, name, get_extension(&args.format));
            let output_path = parent.join(filename);

            if !args.silent {
                println!("\n[{}] Capturing {} viewport...",
                    match name {
                        &"mobile" => "1/3",
                        &"tablet" => "2/3",
                        &"desktop" => "3/3",
                        _ => "?",
                    },
                    name
                );
            }

            let tab = browser.new_tab()?;
            match process_single_url_with_tab(&tab, &args.url, &output_path, &device_args) {
                Ok((metrics, _, _)) => {
                    all_metrics.insert(name.to_string(), vec![metrics]);
                }
                Err(e) => {
                    eprintln!("Error capturing {}: {}", name, e);
                }
            }
        }

        if !args.silent {
            println!("\n========================================");
            println!("Comparison complete: {} viewports captured", devices.len());
            println!("========================================");

            // Print comparison table
            if args.metrics {
                println!("\nPerformance Comparison:");
                println!("{:<12} {:>10} {:>10} {:>10} {:>12}", "Viewport", "TTFB", "FCP", "LCP", "Load Time");
                println!("{}", "-".repeat(60));
                for (device, name) in &devices {
                    if let Some(metrics_list) = all_metrics.get(*name) {
                        if let Some(metrics) = metrics_list.first() {
                            let ttfb = metrics.get("ttfb").unwrap_or(&0.0);
                            let fcp = metrics.get("fcp").unwrap_or(&0.0);
                            let lcp = metrics.get("lcp").unwrap_or(&0.0);
                            let load = metrics.get("loadTime").unwrap_or(&0.0);
                            println!("{:<12} {:>9.0}ms {:>9.0}ms {:>9.0}ms {:>11.0}ms",
                                name, ttfb, fcp, lcp, load);
                        }
                    }
                }
            }
        }
        return Ok(());
    }

    // Single capture mode
    let browser = Browser::default()?;
    let output_path = Path::new(&args.output);

    if let Some(parent) = output_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    process_single_url(&browser, &args.url, output_path, &args)?;

    if !args.silent {
        let elapsed = start_time.elapsed();
        println!("\nCompleted in {:.2}s", elapsed.as_secs_f64());
    }

    Ok(())
}

impl Clone for Args {
    fn clone(&self) -> Self {
        Self {
            url: self.url.clone(),
            device: self.device.clone(),
            output: self.output.clone(),
            format: self.format.clone(),
            quality: self.quality,
            width: self.width,
            height: self.height,
            wait: self.wait,
            dark_mode: self.dark_mode,
            full_page: self.full_page,
            selector: self.selector.clone(),
            grid: self.grid,
            baseline: self.baseline,
            metrics: self.metrics,
            a11y: self.a11y,
            compare: self.compare,
            batch: self.batch,
            delay: self.delay,
            silent: self.silent,
        }
    }
}
