import { getEntries } from "@/lib/entries";

export default async function handler(req, res) {
  const type = req.query.type === "solutions" ? "solutions" : "problems";
  const entries = await getEntries(type);
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
  return res.status(200).json({ type, entries });
}
