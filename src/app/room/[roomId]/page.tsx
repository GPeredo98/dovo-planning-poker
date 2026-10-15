import { Suspense } from "react";
import { RoomScreen } from "@/components/room-screen";

type RoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export default function RoomPage({ params }: RoomPageProps) {
  return (
    <Suspense fallback={
      <main className="app-frame room-frame">
        <div className="room-loading" role="status"><span className="loading-mark" />Loading room…</div>
      </main>
    }>
      <ResolvedRoom params={params} />
    </Suspense>
  );
}

async function ResolvedRoom({ params }: RoomPageProps) {
  const { roomId } = await params;
  return <RoomScreen roomId={roomId} />;
}
