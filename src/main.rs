use clap::Parser;
use headless_chrome::{Browser, LaunchOptionsBuilder};
use std::error::Error;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// URL to capture screenshot from
    #[arg(default_value = "http://localhost:3000")]
    url: String,
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();

    // Launch headless browser
    let browser = Browser::new(
        LaunchOptionsBuilder::default()
            .headless(true)
            .build()
            .expect("Could not find chrome-executable"),
    )?;

    // Create a new tab
    let tab = browser.new_tab()?;

    // Set viewport size
    tab.set_bounds(headless_chrome::types::Bounds::Normal {
        left: Some(0),
        top: Some(0),
        width: Some(1920.0),
        height: Some(1080.0),
    })?;

    // Navigate to the URL
    tab.navigate_to(&args.url)?;

    // Wait for the page to load
    tab.wait_until_navigated()?;

    // Take a full page screenshot
    let png_data = tab.capture_screenshot(
        headless_chrome::protocol::page::ScreenshotFormat::PNG,
        None,
        true,
    )?;

    // Save the screenshot
    std::fs::write("current-view.png", &png_data)?;

    println!("Screenshot saved");

    Ok(())
}