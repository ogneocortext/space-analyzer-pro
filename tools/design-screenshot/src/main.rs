use anyhow::{Context, Result};
use clap::Parser;
use headless_chrome::protocol::cdp::Page;
use headless_chrome::{Browser, LaunchOptions, Tab};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "design-screenshot")]
#[command(about = "Frontend design analysis screenshot tool for Space Analyzer Pro")]
#[command(version = "0.1.0")]
struct Args {
    /// URL to capture
    #[arg(value_name = "URL")]
    url: String,

    /// Output file path
    #[arg(short, long, default_value = "screenshot.png")]
    output: PathBuf,

    /// Viewport width in pixels
    #[arg(long, default_value = "1920")]
    width: u32,

    /// Viewport height in pixels
    #[arg(long, default_value = "1080")]
    height: u32,

    /// Enable dark mode injection
    #[arg(long)]
    dark_mode: bool,

    /// Show 8px grid overlay
    #[arg(long)]
    grid: bool,

    /// Show baseline grid overlay
    #[arg(long)]
    baseline: bool,

    /// Collect performance metrics
    #[arg(long)]
    metrics: bool,

    /// Run accessibility checks
    #[arg(long)]
    a11y: bool,

    /// Capture full page (scroll entire height)
    #[arg(long)]
    full_page: bool,

    /// CSS selector to capture (instead of full viewport)
    #[arg(long)]
    selector: Option<String>,

    /// Image format (png or jpeg)
    #[arg(long, default_value = "png")]
    format: String,

    /// JPEG quality (1-100, only for jpeg format)
    #[arg(long, default_value = "90")]
    quality: u32,

    /// Wait time in milliseconds after page load before capture
    #[arg(long, default_value = "1000")]
    wait: u64,

    /// Output JSON report alongside screenshot
    #[arg(long)]
    report: bool,

    /// Device scale factor (DPR)
    #[arg(long, default_value = "1.0")]
    scale: f64,
}

/// Inject CSS to force dark mode on the page
fn inject_dark_mode(tab: &Arc<Tab>) -> Result<()> {
    tab.evaluate(
        r#"
        (function() {
            const style = document.createElement('style');
            style.textContent = `
                :root {
                    color-scheme: dark;
                }
                @media (prefers-color-scheme: light) {
                    html {
                        filter: invert(1) hue-rotate(180deg);
                    }
                    img, video, canvas, svg, [style*="background-image"] {
                        filter: invert(1) hue-rotate(180deg);
                    }
                }
            `;
            document.head.appendChild(style);
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.style.colorScheme = 'dark';
        })();
        "#,
        false,
    )
    .context("Failed to inject dark mode CSS")?;
    Ok(())
}

/// Inject an 8px grid overlay for alignment checking
fn inject_grid_overlay(tab: &Arc<Tab>, grid_size: u32) -> Result<()> {
    let js = format!(
        r#"
        (function() {{
            const overlay = document.createElement('div');
            overlay.id = 'design-grid-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; z-index: 999999;
                background-image:
                    linear-gradient(rgba(255, 0, 0, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 0, 0, 0.1) 1px, transparent 1px);
                background-size: {size}px {size}px;
            `;
            document.body.appendChild(overlay);
        }})();
        "#,
        size = grid_size,
    );
    tab.evaluate(&js, false).context("Failed to inject grid overlay")?;
    Ok(())
}

/// Inject a baseline typography grid (4px intervals)
fn inject_baseline_grid(tab: &Arc<Tab>) -> Result<()> {
    tab.evaluate(
        r#"
        (function() {
            const overlay = document.createElement('div');
            overlay.id = 'design-baseline-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; z-index: 999998;
                background-image: linear-gradient(rgba(0, 120, 255, 0.08) 1px, transparent 1px);
                background-size: 100% 4px;
            `;
            document.body.appendChild(overlay);
        })();
        "#,
        false,
    )
    .context("Failed to inject baseline grid")?;
    Ok(())
}

/// Collect real browser performance metrics via Performance API
fn get_performance_metrics(tab: &Arc<Tab>) -> Result<HashMap<String, f64>> {
    let result = tab.evaluate(
        r#"
        (function() {
            const nav = performance.getEntriesByType('navigation')[0] || {};
            const paint = performance.getEntriesByType('paint');
            const fcp = paint.find(e => e.name === 'first-contentful-paint');
            const fp = paint.find(e => e.name === 'first-paint');
            const resources = performance.getEntriesByType('resource');
            const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
            return JSON.stringify({
                domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime || 0,
                loadComplete: nav.loadEventEnd - nav.startTime || 0,
                domInteractive: nav.domInteractive - nav.startTime || 0,
                firstPaint: fp ? fp.startTime : 0,
                firstContentfulPaint: fcp ? fcp.startTime : 0,
                ttfb: nav.responseStart - nav.requestStart || 0,
                dnsLookup: nav.domainLookupEnd - nav.domainLookupStart || 0,
                tcpConnect: nav.connectEnd - nav.connectStart || 0,
                resourceCount: resources.length,
                totalTransferSizeKB: totalTransferSize / 1024,
                domNodeCount: document.querySelectorAll('*').length,
            });
        })();
        "#,
        false,
    )
    .context("Failed to get performance metrics")?;

    let json_str = result
        .value
        .as_ref()
        .and_then(|v| v.as_str())
        .unwrap_or("{}");

    let parsed: HashMap<String, f64> = serde_json::from_str(json_str).unwrap_or_default();
    Ok(parsed)
}

/// Run accessibility checks via DOM inspection
fn run_accessibility_checks(tab: &Arc<Tab>) -> Result<Vec<String>> {
    let result = tab.evaluate(
        r#"
        (function() {
            const issues = [];

            // Check images without alt text
            const imgs = document.querySelectorAll('img:not([alt])');
            if (imgs.length > 0) {
                issues.push(`${imgs.length} image(s) missing alt text`);
            }

            // Check empty alt attributes (warn, not error)
            const emptyAlts = document.querySelectorAll('img[alt=""]');
            if (emptyAlts.length > 0) {
                issues.push(`${emptyAlts.length} image(s) with empty alt text (decorative?)`);
            }

            // Check form inputs without labels
            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([aria-labelledby])');
            let unlabeled = 0;
            inputs.forEach(input => {
                const id = input.id;
                if (!id || !document.querySelector(`label[for="${id}"]`)) unlabeled++;
            });
            if (unlabeled > 0) issues.push(`${unlabeled} form input(s) without associated labels`);

            // Check heading hierarchy
            const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
            let prevLevel = 0;
            for (const h of headings) {
                const level = parseInt(h.tagName[1]);
                if (level > prevLevel + 1 && prevLevel > 0) {
                    issues.push(`Heading hierarchy skips from h${prevLevel} to h${level}`);
                    break;
                }
                prevLevel = level;
            }

            // Check color contrast (simplified - checks inline styles)
            const h1Count = document.querySelectorAll('h1').length;
            if (h1Count === 0) issues.push('No h1 element found on page');
            if (h1Count > 1) issues.push(`Multiple h1 elements found (${h1Count})`);

            // Check for missing language attribute
            if (!document.documentElement.lang) {
                issues.push('Missing lang attribute on <html> element');
            }

            // Check for buttons without accessible text
            const buttons = document.querySelectorAll('button');
            let emptyButtons = 0;
            buttons.forEach(btn => {
                if (!btn.textContent.trim() && !btn.getAttribute('aria-label') && !btn.querySelector('img[alt]')) {
                    emptyButtons++;
                }
            });
            if (emptyButtons > 0) issues.push(`${emptyButtons} button(s) without accessible text`);

            // Check for links without href
            const emptyLinks = document.querySelectorAll('a:not([href])').length;
            if (emptyLinks > 0) issues.push(`${emptyLinks} link(s) without href attribute`);

            // Check tab index misuse
            const highTabIndex = document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length;
            if (highTabIndex > 0) issues.push(`${highTabIndex} element(s) with positive tabindex (avoid this)`);

            return JSON.stringify(issues);
        })();
        "#,
        false,
    )
    .context("Failed to run accessibility checks")?;

    let json_str = result
        .value
        .as_ref()
        .and_then(|v| v.as_str())
        .unwrap_or("[]");

    let issues: Vec<String> = serde_json::from_str(json_str).unwrap_or_default();
    Ok(issues)
}

/// Analyze page content structure and design properties
fn analyze_page_content(tab: &Arc<Tab>) -> Result<Vec<String>> {
    let result = tab.evaluate(
        r#"
        (function() {
            const analysis = [];
            const computed = getComputedStyle(document.body);

            // Font analysis
            const allElements = document.querySelectorAll('*');
            const fonts = new Set();
            const fontSizes = new Set();
            const colors = new Set();
            allElements.forEach(el => {
                const style = getComputedStyle(el);
                fonts.add(style.fontFamily.split(',')[0].trim().replace(/"/g, ''));
                fontSizes.add(style.fontSize);
                if (style.color !== 'rgba(0, 0, 0, 0)') colors.add(style.color);
            });
            analysis.push(`Fonts used: ${[...fonts].slice(0, 10).join(', ')}`);
            analysis.push(`Unique font sizes: ${fontSizes.size}`);
            analysis.push(`Unique text colors: ${colors.size}`);

            // Layout analysis
            analysis.push(`Total DOM elements: ${allElements.length}`);

            const flexElements = document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]').length;
            const gridElements = document.querySelectorAll('[style*="display: grid"], [style*="display:grid"]').length;
            analysis.push(`CSS Flex layouts (inline): ${flexElements}, Grid layouts (inline): ${gridElements}`);

            // Interactive elements
            const links = document.querySelectorAll('a[href]').length;
            const buttons = document.querySelectorAll('button, [role="button"]').length;
            const inputs = document.querySelectorAll('input, textarea, select').length;
            analysis.push(`Interactive: ${links} links, ${buttons} buttons, ${inputs} form inputs`);

            // Media
            const images = document.querySelectorAll('img').length;
            const videos = document.querySelectorAll('video').length;
            const svgs = document.querySelectorAll('svg').length;
            analysis.push(`Media: ${images} images, ${videos} videos, ${svgs} SVGs`);

            // Page dimensions
            analysis.push(`Viewport: ${window.innerWidth}x${window.innerHeight}`);
            analysis.push(`Document: ${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`);

            return JSON.stringify(analysis);
        })();
        "#,
        false,
    )
    .context("Failed to analyze page content")?;

    let json_str = result
        .value
        .as_ref()
        .and_then(|v| v.as_str())
        .unwrap_or("[]");

    let analysis: Vec<String> = serde_json::from_str(json_str).unwrap_or_default();
    Ok(analysis)
}

/// Get the full scrollable page dimensions for full-page screenshots
fn get_full_page_dimensions(tab: &Arc<Tab>) -> Result<(f64, f64)> {
    let result = tab.evaluate(
        r#"
        JSON.stringify({
            width: Math.max(
                document.documentElement.scrollWidth,
                document.body.scrollWidth,
                document.documentElement.clientWidth
            ),
            height: Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight,
                document.documentElement.clientHeight
            )
        });
        "#,
        false,
    )
    .context("Failed to get page dimensions")?;

    let json_str = result
        .value
        .as_ref()
        .and_then(|v| v.as_str())
        .unwrap_or(r#"{"width":1920,"height":1080}"#);

    let dims: Value = serde_json::from_str(json_str).unwrap_or(json!({"width": 1920, "height": 1080}));
    Ok((
        dims["width"].as_f64().unwrap_or(1920.0),
        dims["height"].as_f64().unwrap_or(1080.0),
    ))
}

/// Convert format string to headless_chrome screenshot format
fn format_to_capture_format(format: &str) -> Page::CaptureScreenshotFormatOption {
    match format.to_lowercase().as_str() {
        "jpeg" | "jpg" => Page::CaptureScreenshotFormatOption::Jpeg,
        "webp" => Page::CaptureScreenshotFormatOption::Webp,
        _ => Page::CaptureScreenshotFormatOption::Png,
    }
}

/// Main screenshot capture function with all features
fn capture_screenshot(
    tab: &Arc<Tab>,
    args: &Args,
) -> Result<(
    Vec<u8>,
    Option<HashMap<String, f64>>,
    Option<Vec<String>>,
    Option<Vec<String>>,
)> {
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
    let content_analysis = if args.a11y || args.report {
        Some(analyze_page_content(tab)?)
    } else {
        None
    };

    // Handle element-specific capture via CSS selector
    if let Some(ref selector) = args.selector {
        let element = tab
            .find_element(selector)
            .context(format!("Could not find element matching selector: {}", selector))?;
        let data = element
            .capture_screenshot(format_to_capture_format(&args.format))
            .context("Failed to capture element screenshot")?;
        return Ok((data, metrics, a11y_issues, content_analysis));
    }

    // Handle full page capture
    let clip = if args.full_page {
        let (width, height) = get_full_page_dimensions(tab)?;
        Some(Page::Viewport {
            x: 0.0,
            y: 0.0,
            width,
            height,
            scale: args.scale,
        })
    } else {
        None
    };

    // Capture screenshot
    let format = format_to_capture_format(&args.format);
    let quality = if args.format == "jpeg" || args.format == "jpg" {
        Some(args.quality as u32)
    } else {
        None
    };

    let data = tab
        .capture_screenshot(format, quality, clip, !args.full_page)
        .context("Failed to capture screenshot")?;

    Ok((data, metrics, a11y_issues, content_analysis))
}

fn main() -> Result<()> {
    let args = Args::parse();

    eprintln!("📸 Design Screenshot Tool v0.1.0");
    eprintln!("================================");
    eprintln!("🌐 URL: {}", args.url);
    eprintln!(
        "📐 Viewport: {}x{} @ {}x DPR",
        args.width, args.height, args.scale
    );

    // Launch headless Chrome
    let launch_options = LaunchOptions {
        headless: true,
        window_size: Some((args.width, args.height)),
        ..LaunchOptions::default()
    };

    let browser = Browser::new(launch_options).context(
        "Failed to launch Chrome. Ensure Chrome/Chromium is installed and accessible.",
    )?;

    let tab = browser
        .new_tab()
        .context("Failed to create new browser tab")?;

    // Navigate to URL
    eprintln!("🔄 Navigating to {}...", args.url);
    tab.navigate_to(&args.url)
        .context("Failed to navigate to URL")?;

    tab.wait_until_navigated()
        .context("Page navigation timed out")?;

    // Wait for page to settle (animations, lazy loading, etc.)
    eprintln!("⏳ Waiting {}ms for page to stabilize...", args.wait);
    std::thread::sleep(Duration::from_millis(args.wait));

    // Capture screenshot with all features
    let (screenshot_data, metrics, a11y_issues, content_analysis) =
        capture_screenshot(&tab, &args)?;

    // Save screenshot
    fs::write(&args.output, &screenshot_data)
        .context(format!("Failed to write screenshot to {:?}", args.output))?;
    eprintln!(
        "✅ Screenshot saved: {:?} ({} bytes)",
        args.output,
        screenshot_data.len()
    );

    // Print metrics if collected
    if let Some(ref metrics) = metrics {
        eprintln!("\n📊 Performance Metrics:");
        let mut sorted_metrics: Vec<_> = metrics.iter().collect();
        sorted_metrics.sort_by_key(|(k, _)| *k);
        for (key, value) in sorted_metrics {
            eprintln!("   {}: {:.2}", key, value);
        }
    }

    // Print accessibility issues if checked
    if let Some(ref issues) = a11y_issues {
        eprintln!("\n♿ Accessibility Report:");
        if issues.is_empty() {
            eprintln!("   ✅ No accessibility issues found!");
        } else {
            eprintln!("   ⚠️  Found {} issue(s):", issues.len());
            for issue in issues {
                eprintln!("   • {}", issue);
            }
        }
    }

    // Print content analysis
    if let Some(ref analysis) = content_analysis {
        eprintln!("\n🔍 Page Analysis:");
        for item in analysis {
            eprintln!("   • {}", item);
        }
    }

    // Generate JSON report if requested
    if args.report {
        let report = json!({
            "url": args.url,
            "viewport": {
                "width": args.width,
                "height": args.height,
                "scale": args.scale,
            },
            "screenshot": {
                "path": args.output.to_string_lossy(),
                "format": args.format,
                "size_bytes": screenshot_data.len(),
            },
            "dark_mode": args.dark_mode,
            "grid_overlay": args.grid,
            "baseline_grid": args.baseline,
            "performance_metrics": metrics,
            "accessibility_issues": a11y_issues,
            "content_analysis": content_analysis,
        });

        let report_path = args.output.with_extension("json");
        let report_json = serde_json::to_string_pretty(&report)?;
        fs::write(&report_path, &report_json)
            .context(format!("Failed to write report to {:?}", report_path))?;
        eprintln!("\n📄 Report saved: {:?}", report_path);
    }

    eprintln!("\n🎉 Done!");
    Ok(())
}
