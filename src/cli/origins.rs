//! CLI presentation for the origin-tracing / deletion-safety report.

use shared_scanner::format_bytes;
use space_analyzer_pro_desktop::origin_tracer::{OriginAssessment, OriginReport, SafetyLevel};

use crate::animation;
use crate::hprintln;

/// Print a human-readable origin + safety report.
///
/// Goes to stdout in text mode and to stderr whenever stdout has to stay a
/// single machine-readable document (see [`crate::cli::sink`]).
pub fn print_origin_report(report: &OriginReport, no_animation: bool) {
    hprintln!();
    animation::print_section_header_animated("🧭", "ORIGIN & DELETE-SAFETY REPORT", no_animation);
    hprintln!("   Traces each path back to the app/system that created it and");
    hprintln!("   judges whether it is safe to delete. Verdicts:");
    hprintln!("   🟢 SAFE   🟡 REVIEW   🟠 KEEP (LIKELY NEEDED)   🔴 DO NOT DELETE");
    hprintln!();

    hprintln!("   Reclaimable space summary:");
    hprintln!(
        "   🟢 Safe to delete : {} (across {} entries)",
        format_bytes(report.safe_to_delete_bytes),
        count_by(report, SafetyLevel::Safe)
    );
    hprintln!(
        "   🟡 Review first   : {} (across {} entries)",
        format_bytes(report.review_bytes),
        count_by(report, SafetyLevel::Review)
    );
    hprintln!(
        "   🟠 Keep (likely)  : {} (across {} entries)",
        format_bytes(report.caution_bytes),
        count_by(report, SafetyLevel::Caution)
    );
    hprintln!(
        "   🔴 Do not delete  : {} (across {} entries)",
        format_bytes(report.keep_bytes),
        count_by(report, SafetyLevel::DoNotDelete)
    );
    hprintln!();

    print_group(report, SafetyLevel::Safe, "SAFE TO DELETE", no_animation);
    print_group(report, SafetyLevel::Review, "REVIEW FIRST", no_animation);
    print_group(
        report,
        SafetyLevel::Caution,
        "KEEP (LIKELY NEEDED)",
        no_animation,
    );
    print_group(
        report,
        SafetyLevel::DoNotDelete,
        "DO NOT DELETE",
        no_animation,
    );
}

fn count_by(report: &OriginReport, level: SafetyLevel) -> usize {
    report
        .assessments
        .iter()
        .filter(|a| a.safety == level)
        .count()
}

fn print_group(report: &OriginReport, level: SafetyLevel, title: &str, no_animation: bool) {
    let entries: Vec<&OriginAssessment> = report
        .assessments
        .iter()
        .filter(|a| a.safety == level)
        .collect();
    if entries.is_empty() {
        return;
    }
    let total: u64 = entries.iter().map(|a| a.size).sum();
    animation::print_section_header_animated(
        level.emoji(),
        &format!("{title} — {} total", format_bytes(total)),
        no_animation,
    );
    for a in entries {
        print_assessment(a);
    }
    hprintln!();
}

fn print_assessment(a: &OriginAssessment) {
    let kind = if a.is_directory { "dir " } else { "file" };
    hprintln!(
        "   {} [{}] {:>10}  {}",
        a.safety.emoji(),
        kind,
        format_bytes(a.size),
        a.path
    );
    hprintln!("        origin : {}", a.origin);
    hprintln!("        class  : {}", a.category);
    let recoverable = if a.recoverable { "yes" } else { "no" };
    let app = match a.app_installed {
        Some(true) => "installed",
        Some(false) => "NOT found on PATH",
        None => "n/a",
    };
    hprintln!("        recoverable: {recoverable}  | owning app: {app}");
    if !a.related_paths.is_empty() {
        hprintln!("        related:");
        for r in a.related_paths.iter().take(6) {
            hprintln!("          - {r}");
        }
    }
    hprintln!("        why    : {}", a.reasoning);
}

/// Render the origin + safety report as a markdown section (for `--report`).
pub fn origin_markdown(report: &OriginReport) -> String {
    let mut md = String::new();
    md.push_str("## 🧭 Origin & Delete-Safety Report\n\n");
    md.push_str(
        "Each path is traced back to the app/system that created it and judged \
        for deletion safety.\n\n",
    );

    md.push_str("| Verdict | Bytes | Entries |\n|---|---:|---:|\n");
    md.push_str(&format!(
        "| 🟢 Safe to delete | {} | {} |\n",
        format_bytes(report.safe_to_delete_bytes),
        count_by(report, SafetyLevel::Safe)
    ));
    md.push_str(&format!(
        "| 🟡 Review first | {} | {} |\n",
        format_bytes(report.review_bytes),
        count_by(report, SafetyLevel::Review)
    ));
    md.push_str(&format!(
        "| 🟠 Keep (likely needed) | {} | {} |\n",
        format_bytes(report.caution_bytes),
        count_by(report, SafetyLevel::Caution)
    ));
    md.push_str(&format!(
        "| 🔴 Do not delete | {} | {} |\n\n",
        format_bytes(report.keep_bytes),
        count_by(report, SafetyLevel::DoNotDelete)
    ));

    for level in [
        SafetyLevel::Safe,
        SafetyLevel::Review,
        SafetyLevel::Caution,
        SafetyLevel::DoNotDelete,
    ] {
        let entries: Vec<&OriginAssessment> = report
            .assessments
            .iter()
            .filter(|a| a.safety == level)
            .collect();
        if entries.is_empty() {
            continue;
        }
        md.push_str(&format!("### {} {}\n\n", level.emoji(), level.label()));
        for a in &entries {
            let kind = if a.is_directory { "📁" } else { "📄" };
            let rec = if a.recoverable { "yes" } else { "no" };
            let app = match a.app_installed {
                Some(true) => "installed",
                Some(false) => "NOT on PATH",
                None => "n/a",
            };
            md.push_str(&format!(
                "- {} **{}** `{}` — *{}* ({})\n",
                kind,
                format_bytes(a.size),
                a.path,
                a.origin,
                a.category
            ));
            md.push_str(&format!(
                "  - recoverable: **{rec}** · owning app: **{app}**\n"
            ));
            if !a.related_paths.is_empty() {
                md.push_str("  - related:\n");
                for r in a.related_paths.iter().take(6) {
                    md.push_str(&format!("    - {r}\n"));
                }
            }
            md.push_str(&format!("  - why: {}\n", a.reasoning));
        }
        md.push('\n');
    }

    md
}
