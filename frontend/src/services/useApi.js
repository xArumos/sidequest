import { useCallback, useEffect, useState } from 'react'

// Loads data with `load(signal)` whenever `deps` change. Returns the latest
// result, the error from the latest attempt, and reload() for after a write.
export function useApi(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)
  const run = useCallback(load, deps)
  useEffect(() => {
    const controller = new AbortController()
    setState(previous => ({ ...previous, error: null, loading: true }))
    run(controller.signal).then(
      data => { if (!controller.signal.aborted) setState({ data, error: null, loading: false }) },
      error => { if (!controller.signal.aborted) setState({ data: null, error, loading: false }) },
    )
    return () => controller.abort()
  }, [run, attempt])
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  return { ...state, reload }
}
