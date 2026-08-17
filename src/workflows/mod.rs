//! Workflow automation system for Space Analyzer Pro
//!
//! Provides preconfigured scan workflows, automation templates, AI-driven recommendations,
//! and native Rust workflow execution (no external orchestrator needed).
#![allow(dead_code)] // Some workflow methods are only used by modular gui and tests

pub mod types;
pub mod models;
pub mod templates;
pub mod insights;

pub use types::*;
pub use models::*;
pub use templates::*;

use chrono::{DateTime, Local};

/// Check whether a timestamp matches a five-field cron expression.
///
/// Supports `*`, `?`, exact values, lists, ranges, step values, month names,
/// weekday names, `L` for last day/weekday, and `W` for nearest weekday.
pub fn matches_cron(expr: &str, now: &DateTime<Local>) -> bool {
    use chrono::{Datelike, Timelike};

    let fields: Vec<&str> = expr.split_whitespace().collect();
    if fields.len() != 5 {
        return false;
    }

    let minute = now.minute();
    let hour = now.hour();
    let day = now.day();
    let month = now.month();
    let weekday = now.weekday().num_days_from_sunday();
    let last_day = chrono::NaiveDate::from_ymd_opt(now.year(), month, 1)
        .and_then(|date| date.checked_add_months(chrono::Months::new(1)))
        .and_then(|date| date.pred_opt())
        .map(|date| date.day())
        .unwrap_or(31);

    let minute_matches = matches_field(
        fields[0],
        CronMatchContext {
            value: minute,
            min: 0,
            max: 59,
            names: None,
            last_day,
            year: now.year(),
            month: now.month(),
        },
    );
    let hour_matches = matches_field(
        fields[1],
        CronMatchContext {
            value: hour,
            min: 0,
            max: 23,
            names: None,
            last_day,
            year: now.year(),
            month: now.month(),
        },
    );
    let day_matches = matches_field(
        fields[2],
        CronMatchContext {
            value: day,
            min: 1,
            max: last_day,
            names: None,
            last_day,
            year: now.year(),
            month: now.month(),
        },
    );
    let month_matches = matches_field(
        fields[3],
        CronMatchContext {
            value: month,
            min: 1,
            max: 12,
            names: Some(&[
                ("JAN", 1),
                ("JANUARY", 1),
                ("FEB", 2),
                ("FEBRUARY", 2),
                ("MAR", 3),
                ("MARCH", 3),
                ("APR", 4),
                ("APRIL", 4),
                ("MAY", 5),
                ("JUN", 6),
                ("JUNE", 6),
                ("JUL", 7),
                ("JULY", 7),
                ("AUG", 8),
                ("AUGUST", 8),
                ("SEP", 9),
                ("SEPTEMBER", 9),
                ("OCT", 10),
                ("OCTOBER", 10),
                ("NOV", 11),
                ("NOVEMBER", 11),
                ("DEC", 12),
                ("DECEMBER", 12),
            ]),
            last_day,
            year: now.year(),
            month: now.month(),
        },
    );
    let weekday_matches = matches_field(
        fields[4],
        CronMatchContext {
            value: if weekday == 0 { 7 } else { weekday },
            min: 0,
            max: 7,
            names: Some(&[
                ("SUN", 0),
                ("SUNDAY", 0),
                ("MON", 1),
                ("MONDAY", 1),
                ("TUE", 2),
                ("TUESDAY", 2),
                ("WED", 3),
                ("WEDNESDAY", 3),
                ("THU", 4),
                ("THURSDAY", 4),
                ("FRI", 5),
                ("FRIDAY", 5),
                ("SAT", 6),
                ("SATURDAY", 6),
            ]),
            last_day,
            year: now.year(),
            month: now.month(),
        },
    );

    let dom_restricted = !matches!(fields[2], "*" | "?");
    let dow_restricted = !matches!(fields[4], "*" | "?");
    minute_matches
        && hour_matches
        && month_matches
        && if dom_restricted && dow_restricted {
            day_matches || weekday_matches
        } else {
            day_matches && weekday_matches
        }
}

#[derive(Clone, Copy)]
struct CronMatchContext {
    value: u32,
    min: u32,
    max: u32,
    names: Option<&'static [(&'static str, u32)]>,
    last_day: u32,
    year: i32,
    month: u32,
}

fn matches_field(field: &str, ctx: CronMatchContext) -> bool {
    field.split(',').any(|part| matches_field_part(part, ctx))
}

fn matches_field_part(part: &str, ctx: CronMatchContext) -> bool {
    let (range, step) = match part.split_once('/') {
        Some((range, step)) => (range, parse_step(step)),
        None => (part, None),
    };

    if matches!(range, "*" | "?") {
        return step.is_none_or(|step| {
            ctx.value >= ctx.min
                && ctx.value <= ctx.max
                && (ctx.value - ctx.min).is_multiple_of(step)
        });
    }

    if range == "L" {
        return ctx.value == ctx.last_day;
    }

    if let Some(day) = range.strip_suffix('W') {
        if let Some(target) = parse_cron_value(day, ctx.min, ctx.max, ctx.names) {
            return ctx.value == nearest_weekday(target, ctx.last_day, ctx.year, ctx.month);
        }
    }

    if let Some((start, end)) = range.split_once('-') {
        let Some(start) = parse_cron_value(start, ctx.min, ctx.max, ctx.names) else {
            return false;
        };
        let Some(end) = parse_cron_value(end, ctx.min, ctx.max, ctx.names) else {
            return false;
        };
        let start = start.min(end).max(ctx.min);
        let end = end.max(start).min(ctx.max);
        return (start..=end)
            .step_by(step.unwrap_or(1) as usize)
            .any(|candidate| candidate == ctx.value);
    }

    let Some(candidate) = parse_cron_value(range, ctx.min, ctx.max, ctx.names) else {
        return false;
    };
    match step {
        Some(step) => candidate == ctx.value && (ctx.value - ctx.min).is_multiple_of(step),
        None => candidate == ctx.value,
    }
}

fn parse_cron_value(value: &str, min: u32, max: u32, names: Option<&[(&str, u32)]>) -> Option<u32> {
    if let Some(names) = names {
        if let Some((_, mapped)) = names
            .iter()
            .find(|(name, _)| name.eq_ignore_ascii_case(value))
        {
            return Some(*mapped);
        }
    }
    value
        .parse::<u32>()
        .ok()
        .filter(|value| *value >= min && *value <= max)
}

fn parse_step(step: &str) -> Option<u32> {
    step.parse::<u32>().ok().filter(|step| *step > 0)
}

fn nearest_weekday(target: u32, last_day: u32, year: i32, month: u32) -> u32 {
    use chrono::Datelike;
    let target = target.clamp(1, last_day);
    let first = chrono::NaiveDate::from_ymd_opt(year, month, target).expect("valid date");
    let weekday = first.weekday().num_days_from_monday();
    if weekday < 5 {
        return target;
    }
    if target == 1 {
        3
    } else if target == last_day {
        target - 2
    } else if weekday == 5 {
        target - 1
    } else {
        target + 1
    }
}

#[cfg(test)]
mod tests {
    use super::matches_cron;
    use chrono::{Local, TimeZone};

    #[test]
    fn supports_lists_ranges_steps_and_names() {
        let now = Local.with_ymd_and_hms(2026, 6, 12, 9, 30, 0).unwrap();
        assert!(matches_cron("0,15,30,45 9-11/1 12 JUN FRI", &now));
        assert!(matches_cron("*/15 9-11 * June Friday", &now));
        assert!(!matches_cron("*/15 12 * * *", &now));
    }

    #[test]
    fn supports_last_day_and_nearest_weekday() {
        let last_day = Local.with_ymd_and_hms(2026, 6, 30, 0, 0, 0).unwrap();
        let nearest = Local.with_ymd_and_hms(2026, 6, 15, 0, 0, 0).unwrap();
        assert!(matches_cron("0 0 L * *", &last_day));
        assert!(matches_cron("0 0 15W * *", &nearest));
    }
}
