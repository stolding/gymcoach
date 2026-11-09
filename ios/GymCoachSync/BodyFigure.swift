import SwiftUI

/// Voor- en achteraanzicht uit public/bodymap.js.
/// Standaard gekleurd naar de geplande sets van het weekplan. Met fatigue naar absolute vermoeidheid.
struct BodyFigure: View {
    var scores: [PhoneScore]
    var figure: String
    /// Herstelkaart: absolute vermoeidheid. Het weekplan laat dit uit en kleurt naar geplande sets.
    var fatigue: Bool = false
    var accessLabel: String = "Getrainde spiergroepen"

    var body: some View {
        Canvas { ctx, size in
            let shapes = BodyShapes.make(figure)
            let vb = CGSize(width: 400, height: 424)
            let s = min(size.width / vb.width, size.height / vb.height)
            let ox = (size.width - vb.width * s) / 2
            let oy = (size.height - vb.height * s) / 2
            let maxScore = max(1.0, scores.map(\.value).max() ?? 1)
            let byKey = Dictionary(scores.map { ($0.key, $0.value) }, uniquingKeysWith: { a, _ in a })
            func paint(_ parts: [(String, String)], _ base: [String], _ dx: CGFloat, _ caption: String) {
                for d in base {
                    ctx.fill(BodyShapes.path(d, scale: s, ox: ox + dx * s, oy: oy), with: .color(Color.white.opacity(0.08)))
                }
                for (key, d) in parts {
                    let value = byKey[key] ?? 0
                    let lv = fatigue ? BodyShapes.fatigueLevel(value) : BodyShapes.level(value, maxScore)
                    let path = BodyShapes.path(d, scale: s, ox: ox + dx * s, oy: oy)
                    ctx.fill(path, with: .color(BodyShapes.fill(lv)))
                    ctx.stroke(path, with: .color(Color(red: 0.07, green: 0.07, blue: 0.08)), lineWidth: max(0.6, 1.1 * s))
                }
                let label = Text(caption).font(.system(size: 11)).foregroundColor(.secondary)
                ctx.draw(ctx.resolve(label), at: CGPoint(x: ox + (dx + 100) * s, y: oy + 412 * s), anchor: .center)
            }
            paint(shapes.front, shapes.base, 0, "voor")
            paint(shapes.back, shapes.base, 200, "achter")
        }
        .aspectRatio(400 / 424, contentMode: .fit)
        .accessibilityLabel(accessLabel)
    }
}

enum BodyShapes {
    struct Fig {
        var w: [(CGFloat, CGFloat)]
        var pecs: String?
    }

    static let man = Fig(w: [(0, 1), (48, 1.08), (64, 1.14), (92, 1.2), (118, 1.12), (150, 1.0), (186, 0.95), (212, 0.97), (300, 1.0), (420, 1.0)], pecs: nil)
    static let vrouw = Fig(
        w: [(0, 1), (48, 0.88), (64, 0.9), (92, 0.88), (118, 0.86), (150, 0.82), (176, 0.92), (198, 1.12), (226, 1.16), (262, 1.06), (300, 0.98), (420, 0.94)],
        pecs: "M98 78 L82 77 Q70 85 66 102 Q70 120 86 121 Q96 121 98 114 Z"
    )

    static func make(_ name: String) -> (front: [(String, String)], back: [(String, String)], base: [String]) {
        let fig: Fig? = name == "man" ? man : name == "vrouw" ? vrouw : nil
        let front = expand(frontParts, fig)
        let back = expand(backParts, fig)
        var base = [head] + frontBase + hands
        if let fig {
            base = base.map { warp($0, fig, arm: false) }
            let handsStart = 1 + frontBase.count
            for i in handsStart..<base.count { base[i] = warp(hands[i - handsStart], fig, arm: true) }
        }
        return (front, back, base)
    }

    static func level(_ value: Double, _ max: Double) -> Int {
        guard value > 0 else { return 0 }
        let r = value / max
        return r > 0.66 ? 3 : r > 0.33 ? 2 : 1
    }

    // Zelfde grenzen als public/bodymap.js fatigueLevel: punten vermoeidheid, tot 10 is uitgerust.
    static func fatigueLevel(_ value: Double) -> Int {
        if value <= 10 { return 0 }
        if value < 25 { return 1 }
        if value < 50 { return 2 }
        return 3
    }

    static func fill(_ level: Int) -> Color {
        let accent = Color(red: 1, green: 0.478, blue: 0.18)
        switch level {
        case 3: return accent
        case 2: return accent.opacity(0.72)
        case 1: return accent.opacity(0.42)
        default: return Color.white.opacity(0.16)
        }
    }

    static func path(_ d: String, scale: CGFloat, ox: CGFloat, oy: CGFloat) -> Path {
        var path = Path()
        let tokens = tokenize(d)
        var i = 0
        func num() -> CGFloat {
            guard i < tokens.count else { return 0 }
            let n = CGFloat(Double(tokens[i]) ?? 0)
            i += 1
            return n
        }
        func pt() -> CGPoint { CGPoint(x: ox + num() * scale, y: oy + num() * scale) }
        while i < tokens.count {
            let cmd = tokens[i]
            i += 1
            switch cmd {
            case "M": path.move(to: pt())
            case "L": path.addLine(to: pt())
            case "Q":
                let c = pt(), e = pt()
                path.addQuadCurve(to: e, control: c)
            case "Z": path.closeSubpath()
            default: break
            }
        }
        return path
    }

    private static func tokenize(_ d: String) -> [String] {
        var out: [String] = []
        var num = ""
        func flush() { if !num.isEmpty { out.append(num); num = "" } }
        for ch in d {
            if "MLQZ".contains(ch) {
                flush()
                out.append(String(ch))
            } else if ch == "-" && !num.isEmpty {
                flush()
                num = "-"
            } else if ch == " " || ch == "," {
                flush()
            } else {
                num.append(ch)
            }
        }
        flush()
        return out
    }

    private static func expand(_ parts: [(String, String, Bool)], _ fig: Fig?) -> [(String, String)] {
        var out: [(String, String)] = []
        for (key, d, mirrored) in parts {
            var src = d
            if key == "pecs", let pecs = fig?.pecs { src = pecs }
            let left = fig == nil ? src : warp(src, fig!, arm: armKeys.contains(key))
            out.append((key, left))
            if mirrored {
                let rightSrc = mirror(src)
                let right = fig == nil ? rightSrc : warp(rightSrc, fig!, arm: armKeys.contains(key))
                out.append((key, right))
            }
        }
        return out
    }

    private static let armKeys: Set<String> = ["biceps", "triceps", "forearms"]

    private static func widthAt(_ table: [(CGFloat, CGFloat)], _ y: CGFloat) -> CGFloat {
        for i in 1..<table.count {
            let (y1, w1) = table[i], (y0, w0) = table[i - 1]
            if y <= y1 { return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0) }
        }
        return table.last?.1 ?? 1
    }

    private static func warp(_ d: String, _ fig: Fig, arm: Bool) -> String {
        let shift = (100 - 52) * (1 - widthAt(fig.w, 92))
        return replacePairs(d) { x, y in
            let nx = arm ? x + (x < 100 ? shift : -shift) : 100 + (x - 100) * widthAt(fig.w, y)
            return (round1(nx), y)
        }
    }

    private static func mirror(_ d: String) -> String {
        replacePairs(d) { x, y in (200 - x, y) }
    }

    private static func round1(_ n: CGFloat) -> CGFloat { (n * 10).rounded() / 10 }

    private static func replacePairs(_ d: String, _ map: (CGFloat, CGFloat) -> (CGFloat, CGFloat)) -> String {
        guard let re = try? NSRegularExpression(pattern: #"(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)"#) else { return d }
        let ns = d as NSString
        var out = ""
        var last = 0
        for m in re.matches(in: d, range: NSRange(location: 0, length: ns.length)) {
            out += ns.substring(with: NSRange(location: last, length: m.range.location - last))
            let x = CGFloat(Double(ns.substring(with: m.range(at: 1))) ?? 0)
            let y = CGFloat(Double(ns.substring(with: m.range(at: 2))) ?? 0)
            let (nx, ny) = map(x, y)
            out += "\(trim(nx)) \(trim(ny))"
            last = m.range.location + m.range.length
        }
        out += ns.substring(from: last)
        return out
    }

    private static func trim(_ n: CGFloat) -> String {
        let r = (n * 10).rounded() / 10
        return r == r.rounded() ? String(Int(r)) : String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), r)
    }

    private static let head = "M100 10 Q120 12 120 32 Q120 54 100 54 Q80 54 80 32 Q80 12 100 10 Z"
    private static let hands = ["M42 206 Q38 222 44 230 Q52 228 52 210 Z", "M158 206 Q162 222 156 230 Q148 228 148 210 Z"]
    private static let frontBase = [
        "M92 50 L108 50 L110 62 L90 62 Z",
        "M70 68 Q100 60 130 68 L138 110 Q126 120 120 190 Q100 200 80 190 Q74 120 62 110 Z",
        "M80 188 Q100 200 120 188 L116 206 Q100 214 84 206 Z",
        "M74 300 Q72 312 76 322 L88 322 Q92 310 92 300 Z",
        "M126 300 Q128 312 124 322 L112 322 Q108 310 108 300 Z",
        "M74 372 L72 392 Q80 398 90 394 L86 374 Z",
        "M126 372 L128 392 Q120 398 110 394 L114 374 Z",
    ]

    // (spier, pad, ook spiegelen). Paden komen uit public/bodymap.js.
    private static let frontParts: [(String, String, Bool)] = [
        ("traps", "M88 58 Q80 64 70 68 L84 72 Q92 66 96 60 Z", true),
        ("frontDelts", "M70 70 Q56 72 52 88 Q54 100 62 104 Q70 92 78 80 Z", true),
        ("sideDelts", "M52 88 Q46 94 47 108 L54 110 Q54 98 58 92 Z", true),
        ("pecs", "M98 76 L80 76 Q70 84 64 104 Q74 116 98 112 Z", true),
        ("biceps", "M54 112 Q46 126 47 148 Q52 156 58 152 Q63 132 62 112 Z", true),
        ("forearms", "M47 158 Q40 180 41 206 L50 208 Q57 184 58 158 Z", true),
        ("abs", "M88 116 L112 116 Q114 150 112 186 L88 186 Q86 150 88 116 Z", false),
        ("abs", "M86 118 Q74 120 70 132 Q72 162 80 182 L86 184 Q84 150 86 118 Z", true),
        ("adductors", "M98 200 L90 204 Q88 230 94 258 L99 256 Z", true),
        ("quads", "M88 200 Q72 204 68 232 Q68 270 76 300 Q86 306 94 300 Q96 262 90 230 Q88 214 88 200 Z", true),
        ("calves", "M76 322 Q70 344 74 372 L86 374 Q90 346 88 322 Z", true),
    ]
    private static let backParts: [(String, String, Bool)] = [
        ("traps", "M100 56 Q86 62 70 68 Q84 78 92 100 L100 122 L108 100 Q116 78 130 68 Q114 62 100 56 Z", false),
        ("rearDelts", "M70 70 Q56 72 52 88 Q54 100 62 104 Q68 90 80 80 Z", true),
        ("sideDelts", "M52 88 Q46 94 47 108 L54 110 Q54 98 58 92 Z", true),
        ("triceps", "M54 112 Q46 126 47 148 Q52 156 58 152 Q63 132 62 112 Z", true),
        ("forearms", "M47 158 Q40 180 41 206 L50 208 Q57 184 58 158 Z", true),
        ("lats", "M80 82 Q68 96 66 112 Q70 140 84 168 L96 150 L94 104 Z", true),
        ("lowerBack", "M90 150 L110 150 Q114 170 114 188 L86 188 Q86 170 90 150 Z", false),
        ("glutes", "M99 192 Q84 190 76 202 Q74 222 86 230 Q96 230 99 224 Z", true),
        ("hamstrings", "M76 232 Q70 260 74 298 Q84 304 94 298 Q98 266 96 232 Z", true),
        ("calves", "M74 318 Q66 342 72 372 L88 374 Q94 344 90 318 Z", true),
    ]
}
