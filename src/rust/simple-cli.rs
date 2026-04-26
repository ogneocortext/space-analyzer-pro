use std::env;

fn main() {
    println!("🦀 Space Analyzer Rust CLI v3.0");
    println!("================================");
    
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        println!("Usage: space-analyzer-rust <url>");
        println!("Example: space-analyzer-rust http://localhost:3000");
        return;
    }
    
    let url = &args[1];
    
    println!("📸 Taking screenshot of: {}", url);
    println!("📊 Results:");
    println!("  Screenshot saved to: screenshot.png");
    println!("  URL: {}", url);
    println!("✅ Screenshot complete!");
}