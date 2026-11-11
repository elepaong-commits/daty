import { Link } from 'react-router'
import { CategoryIcon } from '../../components/CategoryIcon'
import { toDateInput } from '../../lib/dates'
import { useT } from '../../lib/i18n'
import { useMemories } from '../../lib/queries'

/** "N years ago today": the visits and albums from this day in earlier years. Shows nothing on an ordinary day. */
export function MemoriesToday() {
  const t = useT()
  const { data: memories = [] } = useMemories(toDateInput(new Date()))
  if (memories.length === 0) return null

  return (
    <section className="ui-box-thin flex flex-col gap-3 rounded-2xl bg-amber-soft p-4 retro:m-0.5 retro:bg-white">
      <p className="ui-eyebrow">{t.memories.eyebrow}</p>
      {memories.map((memory) => (
        <div key={memory.year} className="flex flex-col gap-2">
          <h2 className="font-display text-[18px] leading-normal">{t.memories.title(memory.yearsAgo)}</h2>
          {memory.albums.length > 0 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
              {memory.albums.map((album) => (
                <Link key={album.id} to={`/albums/${album.id}`} className="flex w-[132px] shrink-0 flex-col gap-1">
                  <span className="block aspect-[4/3] overflow-hidden rounded-xl bg-sand-soft retro:pixel-outline retro:pixel-thin">
                    {album.coverPhoto?.thumbnailUrl && (
                      <img src={album.coverPhoto.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                  </span>
                  <span className="truncate text-[12px] font-semibold">{album.title}</span>
                  <span className="text-[11px] text-muted">{t.common.photos(album.photoCount)}</span>
                </Link>
              ))}
            </div>
          )}
          {memory.records.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {memory.records.map((record) => {
                const label = (
                  <>
                    <CategoryIcon category={record.category} size={12} /> {record.title}
                  </>
                )
                return (
                  <li key={record.id}>
                    {record.place ? (
                      <Link to={`/places/${record.place.id}`} className="ui-badge flex items-center gap-1 py-[3px]">
                        {label}
                      </Link>
                    ) : (
                      <span className="ui-badge flex items-center gap-1 py-[3px]">{label}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}
