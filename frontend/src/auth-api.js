const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

export async function authRequest(path, body) {
  let response
  try {
    response = await fetch(`${apiBase}/api/auth${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    })
  } catch {
    throw new Error('Unable to reach SideQuest. Check your connection and try again.')
  }
  const result = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    const error = new Error(result?.error?.message || 'Something went wrong. Please try again.')
    error.status = response.status
    throw error
  }
  return result
}
