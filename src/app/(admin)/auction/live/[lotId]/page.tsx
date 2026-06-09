import { createClient } from '@/lib/supabase/server'
import LiveAuctionBoard from '@/components/auction/LiveAuctionBoard'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ lotId: string }> }

export default async function LiveAuctionPage({ params }: Props) {
  const { lotId } = await params
  const supabase = await createClient()

  const [{ data: lot }, { data: allLots }, { data: participants }, { data: settings }] = await Promise.all([
    supabase
      .from('lots')
      .select('*, teams:lot_teams(team:teams(*)), ownerships:lot_ownerships(*, participant:participants(*)), bids(*, participant:participants(*))')
      .eq('id', lotId)
      .single(),
    supabase
      .from('lots')
      .select('id, number, title, status, current_bid, final_price, type')
      .order('number'),
    supabase.from('participants').select('id, name').order('name'),
    supabase.from('calcuta_settings').select('*').single(),
  ])

  if (!lot) notFound()

  const normalizedLot = {
    ...lot,
    teams: lot.teams?.map((lt: any) => lt.team).filter(Boolean) ?? [],
  }

  return (
    <LiveAuctionBoard
      initialLot={normalizedLot}
      allLots={allLots ?? []}
      participants={participants ?? []}
      settings={settings}
    />
  )
}
