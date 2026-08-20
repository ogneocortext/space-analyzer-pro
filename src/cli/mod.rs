pub mod ai_command;
pub mod app_inventory;
pub mod args;
pub mod bloat;
pub mod db_command;
pub mod dedup;
pub mod dependencies;
pub mod helpers;
pub mod history_command;
pub mod live_scan;
pub mod origins;
pub mod output;
pub mod predict;
pub mod recommend;
pub mod recommendations;
pub mod render;
pub mod report;
pub mod scan;
pub mod scan_command;
pub mod search;
pub mod semantic;
pub mod settings_command;
pub mod sink;
pub mod types;
pub mod usn;

use args::{Cli, Commands};
use clap::Parser;
use space_analyzer_pro_desktop::error::AppResult;

pub fn main() -> AppResult<()> {
    let cli = Cli::parse();
    let output_format = cli.format;
    let top_n = cli.top;
    let no_anim = cli.no_animation;
    let yes = cli.yes;

    match cli.command {
        Commands::Scan {
            path,
            path_flag,
            verbose,
            max_depth,
            deep,
            min_size,
            max_size,
            include_hidden,
            threads,
            no_gpu,
            cache,
            export,
            report,
            report_dir,
            clean,
            cleanup_recommendations,
            trace_origins,
            ask,
            stream,
            progress_json,
            files,
            save_history,
            shallow,
        } => {
            let args = scan_command::ScanArgs {
                path: path.or(path_flag),
                verbose,
                max_depth,
                deep,
                shallow,
                min_size,
                max_size,
                include_hidden,
                threads,
                no_gpu,
                cache,
                export,
                report,
                report_dir,
                clean,
                cleanup_recommendations,
                trace_origins,
                ask,
                stream,
                progress_json,
                files,
                save_history,
                output_format,
                top_n,
                no_anim,
            };
            scan_command::handle_scan(args)
        }
        Commands::DiskInfo { path } => ai_command::handle_disk_info(path),
        Commands::History {
            limit,
            offset,
            search,
            sort_by,
            sort_asc,
            id,
            delete,
            prune,
            drop_relative,
            backfill_categories,
            prune_empty,
            clear,
            only_duplicates,
            trend,
            category_totals,
            duplicates,
            summarize,
        } => history_command::handle_history(
            limit,
            offset,
            search,
            sort_by,
            sort_asc,
            id,
            delete,
            prune,
            drop_relative,
            backfill_categories,
            prune_empty,
            clear,
            only_duplicates,
            trend,
            category_totals,
            duplicates,
            summarize,
            output_format,
        ),
        Commands::Dedup {
            path,
            path_flag,
            min_size,
            max_size,
            no_gpu,
            apply,
            scan_id,
        } => {
            sink::route_human_output_to_stderr(output_format.is_machine_readable());
            let path = path.or(path_flag).unwrap_or_else(|| ".".to_string());
            let scan_path = helpers::resolve_scan_path(&path)?;
            let min = min_size
                .as_ref()
                .map(|s| helpers::parse_size(s))
                .transpose()?;
            let max = max_size
                .as_ref()
                .map(|s| helpers::parse_size(s))
                .transpose()?;
            dedup::run_clean_analysis(
                &helpers::display_path(&scan_path),
                output_format,
                min,
                max,
                no_gpu,
                apply,
                yes,
                scan_id,
            )
        }
        Commands::AppInventory => {
            sink::route_human_output_to_stderr(output_format.is_machine_readable());
            app_inventory::handle(output_format)
        }
        Commands::Settings {
            get,
            set,
            key,
            value,
        } => settings_command::handle_settings(get, set, key, value, output_format),
        Commands::Db {
            vacuum,
            info,
            prune_workflows,
            prune_file_cache,
            prune_disk_space,
        } => db_command::handle_db(
            vacuum,
            info,
            prune_workflows,
            prune_file_cache,
            prune_disk_space,
            output_format,
        ),
        Commands::Dependencies { path } => dependencies::run(path, output_format),
        Commands::Embed {
            path,
            scan_id,
            min_size,
            max_size,
            include_hidden,
            no_gpu,
        } => semantic::run_embed(
            path,
            scan_id,
            min_size,
            max_size,
            include_hidden,
            no_gpu,
            output_format,
        ),
        Commands::SemanticSearch {
            query,
            scan_id,
            top,
            min_score,
        } => semantic::run_search(query, scan_id, top, min_score, output_format),
        Commands::Usn { command } => usn::run(command, output_format),
        Commands::Bloat { scan_id, top } => {
            bloat::run(bloat::BloatArgs { scan_id, top }, output_format)
        }
        Commands::Predict { days, limit } => {
            predict::run(predict::PredictArgs { days, limit }, output_format)
        }
        Commands::Recommend { scan_id, top } => {
            recommend::run(recommend::RecommendArgs { scan_id, top }, output_format)
        }
        Commands::Ask { question, scan_id } => ai_command::run_ask(&question, scan_id),
        Commands::Search(args) => search::run(args, output_format),
    }
}
