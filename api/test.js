export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      message: "API server is running",
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}