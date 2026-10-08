import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './api'
import type { Me } from './types'
import { addMonths, startOfMonth } from './dates'

export const keys = {
  me: ['me'] as const,
  places: ['places'] as const,
  records: (month: Date) => ['records', month.getFullYear(), month.getMonth()] as const,
  albums: ['albums'] as const,
}

/** `null` means logged out; the backend answers 401 rather than an empty user. */
export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: () =>
      api.me().catch((err) => {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }),
    staleTime: Infinity,
  })

/** Login, signup, and couple setup all answer with the fresh `Me`. */
function useMeMutation<TInput>(mutationFn: (input: TInput) => Promise<Me>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (me) => queryClient.setQueryData(keys.me, me),
  })
}

export const useLogin = () => useMeMutation(api.login)
export const useSignup = () => useMeMutation(api.signup)
export const useCreateCouple = () => useMeMutation(api.createCouple)
export const useJoinCouple = () => useMeMutation(api.joinCouple)

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      // Flip `me` in place (clear() would detach the gate watching it), then drop every
      // other cached screen so the next account never sees the previous one's data.
      queryClient.setQueryData(keys.me, null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== keys.me[0] })
    },
  })
}

export const usePlaces = () => useQuery({ queryKey: keys.places, queryFn: api.places })

export const useMonthRecords = (month: Date) =>
  useQuery({
    queryKey: keys.records(month),
    queryFn: () => api.records(startOfMonth(month), addMonths(month, 1)),
    placeholderData: (previous) => previous,
  })

export const useAlbums = () => useQuery({ queryKey: keys.albums, queryFn: api.albums })

export function useCreateRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createRecord,
    // A new record can create or promote a place, so the map needs a refresh too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['records'] }),
        queryClient.invalidateQueries({ queryKey: keys.places }),
      ]),
  })
}

export function useCreateAlbum() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createAlbum,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.albums }),
  })
}
