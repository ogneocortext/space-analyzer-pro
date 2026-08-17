use crate::cli::args::OutputFormat;
use space_analyzer_pro_desktop::database::Database;
use space_analyzer_pro_desktop::error::AppResult;

pub fn handle_settings(
    get: bool,
    set: bool,
    key: Option<String>,
    value: Option<String>,
    output_format: OutputFormat,
) -> AppResult<()> {
    if let Ok(db) = Database::default_open() {
        if get {
            match db.get_all_settings() {
                Ok(pairs) => {
                    if output_format == OutputFormat::Json {
                        let map: std::collections::BTreeMap<String, String> =
                            pairs.into_iter().collect();
                        println!("{}", serde_json::to_string_pretty(&map).unwrap_or_default());
                    } else {
                        for (k, v) in pairs {
                            println!("{} = {}", k, v);
                        }
                    }
                }
                Err(e) => eprintln!("Failed to read settings: {}", e),
            }
            return Ok(());
        }
        if set {
            match (key, value) {
                (Some(key), Some(value)) => match db.upsert_settings(&[(&key, value)]) {
                    Ok(written) => {
                        if output_format == OutputFormat::Json {
                            println!(
                                "{}",
                                serde_json::json!({"upserted": written, "success": true})
                            );
                        } else {
                            println!("Upserted {} setting(s).", written);
                        }
                    }
                    Err(e) => eprintln!("Failed to update settings: {}", e),
                },
                _ => eprintln!("settings set requires --key and --value"),
            }
            return Ok(());
        }
        eprintln!("Provide --get or --set with --key and --value");
    } else {
        eprintln!("Failed to open database");
    }
    Ok(())
}
