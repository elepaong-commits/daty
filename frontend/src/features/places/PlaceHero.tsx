import { APILoadingStatus, useApiLoadingStatus, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useQuery } from '@tanstack/react-query'
import { PhotoTile } from '../../components/PhotoTile'
import { MAPS_API_KEY } from '../../lib/maps'
import type { PlaceCategory } from '../../lib/types'
import { useImageFailed } from '../../lib/useImageFailed'

interface Props {
  googlePlaceId: string | null
  /** Shown when Google has no photo for the place: our album cover, else the category tile. */
  fallbackSrc?: string | null
  category: PlaceCategory
  className?: string
}

/** The place detail's top image: the place's first Google Maps photo when it has one. */
export function PlaceHero(props: Props) {
  if (!MAPS_API_KEY || !props.googlePlaceId) return <Fallback {...props} />
  return <GooglePlaceHero {...props} googlePlaceId={props.googlePlaceId} />
}

function Fallback({ fallbackSrc, category, className }: Props) {
  return <PhotoTile src={fallbackSrc} category={category} className={className} iconSize={56} />
}

interface GooglePhoto {
  src: string
  author: { name: string; uri: string | null } | null
}

function GooglePlaceHero(props: Props & { googlePlaceId: string }) {
  const places = useMapsLibrary('places')
  const status = useApiLoadingStatus()
  const mapsFailed = status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE
  const { data: photo, isPending } = useQuery({
    queryKey: ['googlePlacePhoto', props.googlePlaceId],
    queryFn: async (): Promise<GooglePhoto | null> => {
      const place = new places!.Place({ id: props.googlePlaceId })
      await place.fetchFields({ fields: ['photos'] })
      const first = place.photos?.[0]
      if (!first) return null
      const author = first.authorAttributions[0]
      return {
        src: first.getURI({ maxWidth: 1200, maxHeight: 800 }),
        author: author ? { name: author.displayName, uri: author.uri } : null,
      }
    },
    enabled: places !== null,
    // Photo lookups are billed per call; one per place per session is enough.
    staleTime: Infinity,
    retry: false,
  })
  const { failed, onError } = useImageFailed(photo?.src)

  // Hold an empty tile while Maps loads and looks up, so the album cover doesn't flash before the Google photo.
  if (isPending && !mapsFailed) return <div className={`animate-pulse bg-sand-soft ${props.className}`} />
  if (!photo || failed) return <Fallback {...props} />
  return (
    <div className={`relative overflow-hidden ${props.className}`}>
      <img src={photo.src} alt="" onError={onError} className="size-full object-cover" />
      {/* Google requires its name and the photographer's next to Places photos. */}
      <span className="absolute right-2 bottom-2 max-w-[70%] truncate rounded-full bg-night/70 px-2 py-0.5 text-[10px] text-white">
        Google Maps
        {photo.author &&
          (photo.author.uri ? (
            <>
              {' · '}
              <a href={photo.author.uri} target="_blank" rel="noreferrer" className="underline">
                {photo.author.name}
              </a>
            </>
          ) : (
            ` · ${photo.author.name}`
          ))}
      </span>
    </div>
  )
}
