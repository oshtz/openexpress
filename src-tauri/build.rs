fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        cc::Build::new()
            .file("src/macos_services.m")
            .flag("-fobjc-arc")
            .compile("openexpress_macos_services");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }

    tauri_build::build()
}
