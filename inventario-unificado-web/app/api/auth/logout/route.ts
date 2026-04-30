import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ sucesso: true });

  response.cookies.set({
    name: "inv_profile",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
