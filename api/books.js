import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper: upload base64 image to Supabase Storage
async function uploadImage(base64, fileName) {
  const buffer = Buffer.from(base64, 'base64')

  const filePath = `covers/${Date.now()}-${fileName}`

  const { error } = await supabase.storage
    .from('books')
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: false
    })

  if (error) throw error

  const { data } = supabase.storage
    .from('books')
    .getPublicUrl(filePath)

  return data.publicUrl
}

export default async function handler(req, res) {

  // ✅ GET ALL BOOKS
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('createdAt')

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json(data)
  }

  // ✅ CREATE BOOK
  if (req.method === 'POST') {
    try {
      const {
        title,
        subtitle,
        description,
        author,
        type,
        hardcopyPrice,
        ebookPrice,
        currency,
        isLatest,
        publishedYear,
        category,
        coverImageBase64, // 👈 NEW
        coverImageName    // 👈 NEW
      } = req.body

      let coverImage = null

      // Upload image if provided
      if (coverImageBase64 && coverImageName) {
        coverImage = await uploadImage(coverImageBase64, coverImageName)
      }

      const payload = {
        title,
        subtitle,
        description,
        author,
        type,
        hardcopyPrice: hardcopyPrice ? Number(hardcopyPrice) : null,
        ebookPrice: ebookPrice ? Number(ebookPrice) : null,
        currency: currency || "KES",
        isLatest: isLatest === true || isLatest === "true",
        publishedYear: publishedYear ? Number(publishedYear) : null,
        category,
        coverImage
      }

      const { data, error } = await supabase
        .from('books')
        .insert([payload])
        .select()
        .single()

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      return res.status(201).json(data)

    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: "Method not allowed" })
}