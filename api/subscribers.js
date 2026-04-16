import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .order('subscribedAt')

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { email } = req.body

    const { data: existing } = await supabase
      .from('subscribers')
      .select('*')
      .eq('email', email)
      .single()

    if (existing) {
      return res.status(409).json({ error: "Already subscribed" })
    }

    const { data, error } = await supabase
      .from('subscribers')
      .insert([req.body])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    return res.status(201).json(data)
  }

  return res.status(405).json({ error: "Method not allowed" })
}