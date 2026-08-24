import KenarCubugu from '@/components/kenar-cubugu';

export default function PanelYerlesimi({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen">
      <KenarCubugu />
      <main className="min-w-0 flex-1 px-7 py-6">{children}</main>
    </div>
  );
}
