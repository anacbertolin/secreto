// Código de autenticidade (QR) no rodapé dos documentos impressos (migração 0025)
import QRCode from "qrcode";
import { supabase } from "../lib/supabase";

export interface Selo { codigo: string; qr: string; url: string }

/** Gera (ou reaproveita) o código do documento e o QR. Se falhar, o documento sai sem selo. */
export async function seloDoDocumento(tipo: string, ref: string): Promise<Selo | null> {
  const { data, error } = await supabase.rpc("documento_codigo", { p_tipo: tipo, p_ref: ref });
  if (error || !data) return null;
  const url = `${window.location.origin}/verificar/${data}`;
  const qr = await QRCode.toDataURL(url, { margin: 0, width: 220, errorCorrectionLevel: "M" });
  return { codigo: String(data), qr, url };
}

export function SeloAutenticidade({ selo }: { selo: Selo | null }) {
  if (!selo) return null;
  return (
    <div className="selo">
      <img src={selo.qr} alt="QR Code de autenticidade" />
      <div>
        <b>Documento verificável</b><br />
        Aponte a câmera do celular para o código ou acesse<br />
        <span>{window.location.host}/verificar</span> e digite <b>{selo.codigo}</b>
      </div>
    </div>
  );
}
