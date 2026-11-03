import { NextResponse } from "next/server";
import { listClubs } from "@/app/clubs/data";

export async function GET() {
  return NextResponse.json({ clubs: await listClubs() });
}
