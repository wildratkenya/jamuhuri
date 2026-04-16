import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const [books, orders, subscribers, podcasts] = await Promise.all([
    supabase.from('books').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('subscribers').select('*', { count: 'exact', head: true }),
    supabase.from('podcasts').select('*', { count: 'exact', head: true }),
  ])

  return res.status(200).json({
    totalBooks: books.count,
    totalOrders: orders.count,
    totalSubscribers: subscribers.count,
    totalPodcasts: podcasts.count
  })
}