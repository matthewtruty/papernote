import Foundation

struct FiledNoteSummary: Codable, Hashable, Identifiable {
    let id: UUID
    var title: String
    let createdAt: Date
    var updatedAt: Date
}
