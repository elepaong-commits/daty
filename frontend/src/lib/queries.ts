import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { addMonths, startOfMonth } from './dates'

export const keys = {
  couple: ['couple'] as const,
  places: ['places'] as const,
  records: (month: Date) => ['records', month.getFullYear(), month.getMonth()] as const,
  albums: ['albums'] as const,
}

export const useCouple = () => useQuery({ queryKey: keys.couple, queryFn: api.couple })

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
