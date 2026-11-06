import SwiftUI

/// Halter uit public/logo.svg, dezelfde vorm als het app-icoon.
struct Mark: View {
    var size: CGFloat = 72

    var body: some View {
        Canvas { ctx, canvas in
            let s = canvas.width / 1024
            func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ rad: CGFloat) -> Path {
                Path(roundedRect: CGRect(x: x * s, y: y * s, width: w * s, height: h * s), cornerRadius: rad * s)
            }
            let orange = Color(red: 1, green: 0.478, blue: 0.180)
            let dark = Color(red: 0.059, green: 0.063, blue: 0.071)
            let cream = Color(red: 1, green: 0.890, blue: 0.812)
            ctx.fill(box(0, 0, 1024, 1024, 224), with: .color(orange))
            ctx.fill(box(200, 400, 72, 224, 36), with: .color(dark))
            ctx.fill(box(300, 300, 72, 424, 36), with: .color(dark))
            ctx.fill(box(372, 480, 280, 64, 0), with: .color(dark))
            ctx.fill(box(652, 300, 72, 424, 36), with: .color(dark))
            ctx.fill(box(752, 400, 72, 224, 36), with: .color(dark))
            let screen = box(422, 322, 180, 128, 20)
            ctx.fill(screen, with: .color(cream))
            ctx.stroke(screen, with: .color(dark), lineWidth: 16 * s)
            var line = Path()
            line.move(to: CGPoint(x: 450 * s, y: 420 * s))
            line.addLine(to: CGPoint(x: 484 * s, y: 386 * s))
            line.addLine(to: CGPoint(x: 508 * s, y: 406 * s))
            line.addLine(to: CGPoint(x: 572 * s, y: 350 * s))
            ctx.stroke(line, with: .color(orange), style: StrokeStyle(lineWidth: 16 * s, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("GymCoach")
    }
}
