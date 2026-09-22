import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(145deg, #07090C, #294865)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#F4F7FA",
          fontSize: 96,
          fontWeight: 600,
        }}
      >
        B
      </div>
    ),
    size,
  );
}
