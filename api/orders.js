import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('createdAt')

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const payload = {
      ...req.body,
      status: "pending"
    }

    const { data, error } = await supabase
      .from('orders')
      .insert([payload])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    return res.status(201).json(data)
  }

  return res.status(405).json({ error: "Method not allowed" })
}