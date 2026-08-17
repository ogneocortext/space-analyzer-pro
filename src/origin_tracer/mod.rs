pub mod safety;
pub mod classifiers;
pub mod tracer;

pub use safety::{Classification, Ctx, OriginAssessment, OriginReport, SafetyLevel};
pub use classifiers::{any_app_installed, classify_path, is_project_root};
pub use tracer::{assess_directory, assess_file, build_report};

mod tests {
    #![allow(unused_imports)]
    use crate::gui_common::{DirEntry, ScanReport};
    use super::*;

    #[test]
    fn classifies_credentials_as_do_not_delete() {
        let c = classify_path("C:\\Users\\someone\\.ssh\\id_rsa");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
        assert_eq!(c.category, "Credentials");
    }

    #[test]
    fn classifies_git_as_do_not_delete() {
        let c = classify_path("C:\\proj\\.git");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
        assert_eq!(c.category, "VCS");
    }

    #[test]
    fn classifies_node_modules_as_safe() {
        let c = classify_path("C:\\proj\\node_modules");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert!(c.recoverable);
    }

    #[test]
    fn classifies_target_as_safe() {
        let c = classify_path("C:\\proj\\target");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Build Output");
    }

    #[test]
    fn classifies_documents_as_do_not_delete() {
        let c = classify_path("C:\\Users\\someone\\Documents");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
    }

    #[test]
    fn classifies_recycle_bin_as_safe() {
        let c = classify_path("C:\\$Recycle.Bin\\S-1-5-21");
        assert_eq!(c.safety, SafetyLevel::Safe);
    }

    #[test]
    fn classifies_ollama_as_review() {
        let c = classify_path("C:\\Users\\someone\\.ollama");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "Ollama (local LLM models)");
    }

    #[test]
    fn classifies_nuget_packages_as_safe() {
        let c = classify_path("C:\\Users\\someone\\.nuget\\packages\\newtonsoft.json");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert!(c.recoverable);
    }

    #[test]
    fn classifies_appdata_roaming_as_caution() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Roaming\\SomeApp");
        assert_eq!(c.safety, SafetyLevel::Caution);
    }

    #[test]
    fn classifies_appdata_local_cache_as_safe() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Local\\SomeApp\\Cache");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Cache");
    }

    #[test]
    fn classifies_site_packages_as_caution() {
        // Installed package contents (e.g. torch) must NOT be flagged safe.
        let c = classify_path("C:\\Python311\\Lib\\site-packages\\torch\\lib");
        assert_eq!(c.safety, SafetyLevel::Caution);
        assert_eq!(c.origin, "Python (installed packages)");
    }

    #[test]
    fn classifies_venv_root_as_safe() {
        let c = classify_path("C:\\proj\\.venv");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.origin, "Python (virtual environment)");
    }

    #[test]
    fn classifies_wsl_vhdx_as_caution() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Local\\wsl\\{guid}\\ext4.vhdx");
        assert_eq!(c.safety, SafetyLevel::Caution);
        assert_eq!(c.category, "Virtualization");
    }

    #[test]
    fn classifies_android_avd_as_review() {
        let c = classify_path("C:\\Users\\someone\\.android\\avd\\Moto_API_35.avd");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.category, "Virtualization");
    }

    #[test]
    fn classifies_unknown_as_review() {
        let c = classify_path("C:\\Users\\someone\\some_mystery_folder");
        assert_eq!(c.safety, SafetyLevel::Review);
    }

    #[test]
    fn classifies_program_files_as_do_not_delete() {
        let c = classify_path("C:\\Program Files\\SomeApp");
        assert_eq!(c.safety, SafetyLevel::DoNotDelete);
    }

    #[test]
    fn safety_rank_orders_caution_first() {
        assert!(SafetyLevel::DoNotDelete.rank() < SafetyLevel::Safe.rank());
    }

    #[test]
    fn build_report_aggregates_totals() {
        let mut result = ScanReport::new();
        result.path = "C:\\test".to_string();
        result.top_directories.push(DirEntry {
            path: "C:\\test\\node_modules".to_string(),
            name: "node_modules".to_string(),
            total_size: 1_000_000,
            file_count: 100,
            dir_count: 5,
        });
        result.top_directories.push(DirEntry {
            path: "C:\\test\\Documents".to_string(),
            name: "Documents".to_string(),
            total_size: 5_000_000,
            file_count: 50,
            dir_count: 2,
        });

        let report = build_report(&result, 50, 50);
        assert_eq!(report.total_assessed, 2);
        assert_eq!(report.safe_to_delete_bytes, 1_000_000);
        assert_eq!(report.keep_bytes, 5_000_000);
        assert_eq!(report.assessed_bytes(), 6_000_000);
    }

    #[test]
    fn classifies_browserclaw_as_review() {
        let c = classify_path("C:\\Users\\someone\\.browserclaw\\replays");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "BrowserClaw / BrowserOS (AI browser agent)");
    }

    #[test]
    fn classifies_kilo_local_share_as_review() {
        let c = classify_path("C:\\Users\\someone\\.local\\share\\kilo");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "Kilo Code (AI coding agent)");
    }

    #[test]
    fn classifies_updater_cache_as_safe() {
        let c = classify_path("C:\\Users\\someone\\AppData\\Local\\eigent-updater");
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Cache");
    }

    #[test]
    fn classifies_u2net_as_review() {
        let c = classify_path("C:\\Users\\someone\\.u2net");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "U2Net (AI segmentation model)");
    }

    #[test]
    fn classifies_user_profile_bin_as_review() {
        let c = classify_path("C:\\Users\\someone\\bin");
        assert_eq!(c.safety, SafetyLevel::Review);
        assert_eq!(c.origin, "User-installed binaries");
    }

    #[test]
    fn classifies_setup_guide_library_as_safe() {
        let c = classify_path("C:\\Users\\Aomega Imaging\\Setup Guide In-Editor Tutorial\\Library");
        eprintln!(
            "DEBUG setup guide: safety={:?}, origin={}, category={}",
            c.safety, c.origin, c.category
        );
        assert_eq!(c.safety, SafetyLevel::Safe);
        assert_eq!(c.category, "Build Output");
    }
}
