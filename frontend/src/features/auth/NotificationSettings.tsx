import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { currentSubscription, disablePush, enablePush, PushDeniedError, pushSupported } from '../../lib/push'

const key = ['push', 'subscribed'] as const

/** Turns morning and partner notifications on or off for this device. */
export function NotificationSettings() {
  const { lang, t } = useI18n()
  const queryClient = useQueryClient()
  const { data: subscribed = false } = useQuery({
    queryKey: key,
    queryFn: async () => (await currentSubscription()) !== null,
    enabled: pushSupported,
    staleTime: 0,
  })
  const toggle = useMutation({
    mutationFn: () => (subscribed ? disablePush() : enablePush(lang)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  const test = useMutation({ mutationFn: api.testPush })
  const error = toggle.error ?? test.error

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-card-border p-4">
      <p className="text-[12px] leading-normal font-semibold text-muted">{t.notifications.title}</p>
      <p className="text-[12px] leading-normal text-muted">{pushSupported ? t.notifications.help : t.notifications.unsupported}</p>
      {pushSupported && (
        <>
          {subscribed && <p className="text-[13px] font-semibold text-brand-text">{t.notifications.on}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
              className={`h-11 flex-1 rounded-xl text-[14px] font-semibold disabled:opacity-50 ${subscribed ? 'bg-sand-soft' : 'bg-brand-strong text-white'}`}
            >
              {toggle.isPending ? t.common.wait : subscribed ? t.notifications.disable : t.notifications.enable}
            </button>
            {subscribed && (
              <button
                type="button"
                onClick={() => test.mutate()}
                disabled={test.isPending}
                className="h-11 flex-1 rounded-xl bg-brand-soft text-[14px] font-semibold text-brand-text disabled:opacity-50"
              >
                {test.isPending ? t.common.wait : test.isSuccess ? t.notifications.testSent : t.notifications.test}
              </button>
            )}
          </div>
        </>
      )}
      {error && (
        <p className="text-[12px] text-coral-strong">
          {error instanceof PushDeniedError ? t.notifications.denied : errorMessage(error, t)}
        </p>
      )}
    </div>
  )
}
