macro_rules! icon_fn {
    ($name:ident, $char:literal) => {
        #[allow(dead_code)]
        pub fn $name() -> Option<(u32, &'static str)> {
            Some(($char.chars().next().unwrap_or('?') as u32, "emoji"))
        }
    };
}

icon_fn!(scan, "📁");
icon_fn!(history, "🕒");
icon_fn!(disk, "💾");
icon_fn!(system, "🖥");
icon_fn!(trend, "📈");
icon_fn!(workflow, "⚙");
icon_fn!(filetype, "📄");
icon_fn!(predict, "🔮");
icon_fn!(pattern, "🔍");
icon_fn!(tool, "🔧");
icon_fn!(quick, "⚡");
icon_fn!(model, "🤖");
icon_fn!(index, "📊");
icon_fn!(security, "🛡");
icon_fn!(cleanup, "🧹");
icon_fn!(performance, "🏎");
icon_fn!(check, "✓");
icon_fn!(warning, "⚠");
