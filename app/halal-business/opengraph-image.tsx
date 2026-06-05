import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HB9 decentralized business ecosystem";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #04111f 0%, #082746 44%, #06131f 100%)",
          color: "#f8fbff",
          fontFamily: "Inter, Arial, sans-serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 80% 20%, rgba(34,211,238,0.32) 0, rgba(34,211,238,0) 28%), radial-gradient(circle at 18% 80%, rgba(16,185,129,0.24) 0, rgba(16,185,129,0) 26%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 72,
            width: 330,
            height: 330,
            borderRadius: 40,
            border: "2px solid rgba(125, 249, 255, 0.28)",
            background: "rgba(7, 22, 39, 0.64)",
            boxShadow: "0 30px 90px rgba(0,0,0,0.34)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 210,
              height: 210,
              borderRadius: 105,
              background: "linear-gradient(135deg, #22d3ee, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 60px rgba(34,211,238,0.45)"
            }}
          >
            <div style={{ fontSize: 74, fontWeight: 900, letterSpacing: 0 }}>HB9</div>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 520px 64px 72px"
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 900, color: "#67e8f9", letterSpacing: 0 }}>HB9</div>
          <div style={{ marginTop: 22, fontSize: 66, lineHeight: 1.03, fontWeight: 900, letterSpacing: 0 }}>
            The Future of Decentralized Business
          </div>
          <div style={{ marginTop: 28, fontSize: 27, lineHeight: 1.35, color: "#d7f7ff" }}>
            AI powered packages, blockchain technology, token utility, and global community growth.
          </div>
          <div style={{ marginTop: 42, display: "flex", gap: 14 }}>
            {["AI Packages", "HB9 Token", "Global Growth"].map((item) => (
              <div
                key={item}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(103,232,249,0.35)",
                  background: "rgba(8, 47, 73, 0.62)",
                  padding: "12px 18px",
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#ecfeff"
                }}
              >
                {item}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 44, fontSize: 24, fontWeight: 800, color: "#fef9c3" }}>www.hb9.live</div>
        </div>
      </div>
    ),
    size
  );
}
