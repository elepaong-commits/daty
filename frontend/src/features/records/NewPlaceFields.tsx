import { MapPin } from 'lucide-react'
import mapPinIcon from '../../assets/icons/map-pin.svg'
import { Field, inputClass } from '../../components/Field'
import { useT } from '../../lib/i18n'
import type { PickedPlace } from '../../lib/places'
import { PlaceSearch } from './PlaceSearch'

interface Props {
  mapUrl: string
  onMapUrlChange: (url: string) => void
  mapLinkLabel: string
  name: string
  onNameChange: (name: string) => void
  picked: PickedPlace | null
  onPick: (place: PickedPlace | null) => void
  /** Edit styling from the design: pin icon that opens the link, plus a hint. */
  editing?: boolean
}

/** A place not saved yet: optional Google Maps link plus a name searched on Google. */
export function NewPlaceFields({ mapUrl, onMapUrlChange, mapLinkLabel, name, onNameChange, picked, onPick, editing = false }: Props) {
  const t = useT()
  return (
    <>
      <Field label={mapLinkLabel}>
        <div className={`${inputClass} flex items-center gap-2.5 focus-within:border-brand`}>
          {!editing && <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-muted" />}
          <input
            type="url"
            inputMode="url"
            value={mapUrl}
            onChange={(e) => onMapUrlChange(e.target.value)}
            placeholder="https://maps.app.goo.gl/..."
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder"
          />
          {editing &&
            (mapUrl.trim() ? (
              <a href={mapUrl.trim()} target="_blank" rel="noreferrer" aria-label={t.schedule.openInMap}>
                <img src={mapPinIcon} alt="" width={16} height={16} />
              </a>
            ) : (
              <img src={mapPinIcon} alt="" width={16} height={16} />
            ))}
        </div>
      </Field>
      {editing && <p className="pt-1.5 text-[11px] text-brand-text">{t.schedule.mapLinkHint}</p>}

      <Field label={t.common.placeName} className="pt-4">
        <PlaceSearch name={name} onNameChange={onNameChange} picked={picked} onPick={onPick} />
      </Field>
    </>
  )
}
