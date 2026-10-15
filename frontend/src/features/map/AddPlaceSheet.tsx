import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Chip } from '../../components/Field'
import { MemoInput } from '../../components/Memo'
import { errorMessage } from '../../lib/api'
import { FORM_CATEGORY_ORDER } from '../../lib/categories'
import { useT } from '../../lib/i18n'
import { encodeMemo } from '../../lib/memo'
import { useCreatePlace, usePlaces } from '../../lib/queries'
import type { Place, PlaceCategory } from '../../lib/types'
import { NewPlaceFields } from '../records/NewPlaceFields'
import type { PickedPlace } from '../records/PlaceSearch'

interface Props {
  onClose: () => void
  onSaved: (place: Place) => void
}

/** Save a place the couple wants to go to, straight onto the map, with an optional tagged memo. */
export function AddPlaceSheet({ onClose, onSaved }: Props) {
  const t = useT()
  const createPlace = useCreatePlace()
  const { data: places = [] } = usePlaces()
  const [mapUrl, setMapUrl] = useState('')
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<PickedPlace | null>(null)
  const [category, setCategory] = useState<PlaceCategory>('CAFE')
  const [memo, setMemo] = useState('')

  // The backend refuses the same Google place twice, so point to the saved one up front.
  const existing = picked ? places.find((p) => p.googlePlaceId === picked.googlePlaceId) : undefined
  const canSave = name.trim() !== '' && !existing && !createPlace.isPending

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    createPlace.mutate(
      {
        name: name.trim(),
        category,
        status: 'WISH',
        googleMapsUrl: mapUrl.trim() || picked?.googleMapsUrl,
        googlePlaceId: picked?.googlePlaceId,
        address: picked?.address,
        latitude: picked?.latitude,
        longitude: picked?.longitude,
        note: encodeMemo(memo) || undefined,
      },
      { onSuccess: onSaved },
    )
  }

  return (
    <BottomSheet title={t.addPlace.title} onClose={onClose}>
      <form onSubmit={submit}>
        <NewPlaceFields
          mapUrl={mapUrl}
          onMapUrlChange={setMapUrl}
          mapLinkLabel={t.addPlace.mapLink}
          name={name}
          onNameChange={setName}
          picked={picked}
          onPick={(place) => {
            setPicked(place)
            if (place?.category) setCategory(place.category)
          }}
        />
        {existing && (
          <p className="pt-1.5 text-[11px] font-medium text-coral-strong">
            {t.addPlace.alreadySaved}{' '}
            <Link to={`/places/${existing.id}`} className="font-semibold text-brand">
              {t.addPlace.viewSaved}
            </Link>
          </p>
        )}

        <div className="flex flex-col gap-1.5 pt-4">
          <span className="text-[12px] leading-normal font-semibold text-muted">{t.common.placeCategory}</span>
          <div className="flex flex-wrap gap-2">
            {FORM_CATEGORY_ORDER.map((value) => {
              return (
                <Chip key={value} selected={category === value} onClick={() => setCategory(value)}>
                  <CategoryIcon category={value} /> {t.categories[value]}
                </Chip>
              )
            })}
          </div>
        </div>

        <MemoInput
          label={t.addPlace.memo}
          value={memo}
          onChange={setMemo}
          placeholder={t.addPlace.memoPlaceholder}
          maxLength={500}
          className="pt-4"
        />

        {createPlace.error && (
          <p className="pt-3 text-[12px] text-coral-strong">
            {t.common.saveFailed}: {errorMessage(createPlace.error, t)}
          </p>
        )}

        <div className="pt-5">
          <button
            type="submit"
            disabled={!canSave}
            className="ui-btn h-12 w-full rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta disabled:opacity-50 disabled:shadow-none retro:mb-1.5 retro:text-[14px]"
          >
            {createPlace.isPending ? t.common.saving : t.addPlace.save}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
