// swift-tools-version: 6.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Papernote",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "Papernote",
            targets: ["Papernote"]
        )
    ],
    targets: [
        .executableTarget(
            name: "Papernote"
        ),
        .testTarget(
            name: "PapernoteTests",
            dependencies: ["Papernote"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
