import { redirect } from 'next/navigation';

/**
 * Eski adres. "TEKNOFEST Kataloğu" ve "Yarışma Yönetimi" ekranları
 * /yarismalar altında birleşti — ikisi de yarışma listesiydi ve aradaki
 * fark kullanıcının değil sistemin iç meselesiydi.
 *
 * Yönlendirme bırakılıyor: kayıtlı bağlantılar ve tarayıcı geçmişi kırılmasın.
 */
export default function EskiAdres() {
  redirect('/yarismalar');
}
