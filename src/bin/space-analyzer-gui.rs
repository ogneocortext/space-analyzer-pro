use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::path::PathBuf;

fn log_dir() -> PathBuf {
    std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("APPDATA"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("space-analyzer-pro")
        .join("logs")
}

fn main() -> Result<(), eframe::Error> {
    let dir = log_dir();
    let _ = std::fs::create_dir_all(&dir);

    let file_appender = tracing_appender::rolling::daily(&dir, "space-analyzer.log");
    let (file_writer, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "space_analyzer_pro_desktop=info".into()))
        .with(tracing_subscriber::fmt::layer().with_writer(file_writer).with_ansi(false))
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stdout))
        .init();

    tracing::info!(target: "app", dir=%dir.display(), "Starting Space Analyzer Pro GUI");

    space_analyzer_pro_desktop::gui::run_gui()
}
