import { KeywordDoc, Locale } from "../types.js";

export const KRL_SYNTAX_DB: Record<string, KeywordDoc> = {
  PTP: {
    description: {
      en: "Point-to-Point (PTP) motion. The controller synchronizes all axes to arrive at target simultaneously. Fastest motion type, unaffected by Cartesian singularities.",
      ru: "Движение от точки к точке (PTP). Контроллер синхронизирует все оси для одновременного достижения цели. Наиболее быстрое движение, не подверженное декартовым сингулярностям.",
      de: "Punkt-zu-Punkt-Bewegung (PTP). Alle Achsen erreichen das Ziel synchron auf zeitoptimalen Bahnen.",
      es: "Movimiento punto a punto (PTP). Los ejes se sincronizan para llegar simultaneamente al destino.",
      it: "Movimento punto a punto (PTP). Tutti gli assi arrivano a destinazione in modo sincronizzato.",
      tr: "Noktadan Noktaya (PTP) hareket. Tum eksenler hedefe aynı anda varacak sekilde senkronize edilir.",
    },
    syntax: "PTP TargetPoint [C_DIS | C_PTP | C_ORI | C_VEL]",
    example: "PTP XP1 Vel=100 % PDAT1 C_PTP",
  },
  LIN: {
    description: {
      en: "Linear (LIN) Cartesian motion. The TCP moves along a straight line in space at constant path velocity ($VEL.CP). Orientation angles (A, B, C) are interpolated linearly.",
      ru: "Линейное декартово перемещение (LIN). Инструмент (TCP) перемещается по прямой линии в пространстве с постоянной скоростью ($VEL.CP).",
      de: "Lineare kartesische Bewegung (LIN). Der TCP faehrt auf einer Geraden mit Bahngeschwindigkeit.",
      es: "Movimiento lineal (LIN). El TCP se desplaza en linea recta en el espacio a velocidad de trayectoria constante.",
      it: "Movimento lineare (LIN). Il TCP si sposta lungo una retta con velocita di traiettoria costante.",
      tr: "Dogrusal (LIN) Kartezyen hareket. TCP uzayda duz bir cizgi boyunca sabit hızla hareket eder.",
    },
    syntax: "LIN TargetPoint [C_DIS | C_ORI | C_VEL]",
    example: "LIN XP2 Vel=0.5 m/s CPDAT2 C_DIS",
  },
  CIRC: {
    description: {
      en: "Circular (CIRC) motion. Requires TWO target points: Auxiliary Point (AuxPoint) defining arc radius and Target Point (TargetPoint).",
      ru: "Круговое декартово перемещение (CIRC). Требует ОБЯЗАТЕЛЬНО две точки: вспомогательную (AuxPoint) и конечную (TargetPoint).",
      de: "Kreisfoermige Bewegung (CIRC). Benoetigt Hilfspunkt (AuxPoint) und Zielpunkt (TargetPoint).",
      es: "Movimiento circular (CIRC). Requiere dos puntos: punto auxiliar (AuxPoint) y punto final (TargetPoint).",
      it: "Movimento circolare (CIRC). Richiede punto ausiliario (AuxPoint) e punto finale (TargetPoint).",
      tr: "Dairesel (CIRC) hareket. Yardımcı nokta (AuxPoint) ve hedef nokta (TargetPoint) gerektirir.",
    },
    syntax: "CIRC AuxPoint, TargetPoint [CA ArcAngle] [C_DIS]",
    example: "CIRC XAUX, XTARGET CA 180 C_DIS",
  },
  SPLINE: {
    description: {
      en: "Modern KSS 8.3-8.7 Spline Block. Guarantees true polynomial trajectory interpolation with exact velocity profile and no stopping at segment transitions.",
      ru: "Современный сплайновый блок KSS 8.3-8.7. Гарантирует сглаженную полиномиальную траекторию без снижения скорости на стыках сегментов.",
      de: "Moderner Spline-Block (KSS 8.3+). Polynomielle Bahninterpolation ohne Geschwindigkeitsabfall.",
      es: "Bloque Spline moderno para KSS 8.3-8.7. Garantiza interpolacion polinomica suave.",
      it: "Blocco Spline moderno per KSS 8.3-8.7. Garantisce traiettoria polinomiale fluida.",
      tr: "Modern Spline blogu (KSS 8.3-8.7). Gecislerde hız kaybetmeden polinomik yorunge uretir.",
    },
    syntax: "SPLINE [WITH $VEL.CP = ..., $ACC.CP = ...]\n  SPL P1\n  SLIN P2\n  SCIRC PAUX, P3\nENDSPLINE",
    example: "SPLINE\n  SPL XP1\n  SLIN XP2\nENDSPLINE",
  },
  INTERRUPT: {
    description: {
      en: "Interrupt declaration and control. Allows instantaneous reaction (within 12ms) to physical digital inputs or cyclic flags.",
      ru: "Объявление и управление прерываниями. Обеспечивает мгновенную реакцию (до 12 мс) на входы датчиков или флаги без задержки цикла.",
      de: "Interrupt-Deklaration und Steuerung. Reaktion im 12ms-Takt auf Signale.",
      es: "Declaracion y control de interrupciones para reaccionar inmediatamente a senales.",
      it: "Dichiarazione e gestione degli interrupt per reagire rapidamente a segnali.",
      tr: "Kesme tanımlama ve kontrolu. Sensör girislerine veya bayraklara 12ms icinde tepki verir.",
    },
    syntax: "GLOBAL INTERRUPT DECL Priority WHEN Condition DO Subprogram()\nINTERRUPT ON [Priority]\nINTERRUPT OFF [Priority]",
    example: "GLOBAL INTERRUPT DECL 10 WHEN $IN[5] == TRUE DO STOP_ROUTINE()\nINTERRUPT ON 10",
  },
  TRIGGER: {
    description: {
      en: "Path trigger for switching digital outputs or subprograms precisely at a point or time offset relative to motion trajectory without stopping advance run.",
      ru: "Контурный триггер для коммутации выходов ($OUT) или вызова подпрограммы в точной точке траектории без останова предварительного расчета ($ADVANCE).",
      de: "Bahntrigger fuer schaltende Ausgaenge ohne Vorlaufstopp.",
      es: "Trigger de trayectoria para conmutar senales sin detener el puntero de avance.",
      it: "Trigger di traiettoria per attivare uscite senza arrestare l'avanzamento.",
      tr: "Ileri hesaplamayı durdurmadan yorunge uzerinde cıkıs tetiklemek icin TRIGGER kullanılır.",
    },
    syntax: "TRIGGER WHEN DISTANCE=0 DELAY=0 DO $OUT[1]=TRUE\nTRIGGER WHEN PATH=0 ONSTART DO MY_SUB() PRIO=-1",
    example: "TRIGGER WHEN DISTANCE=1 DELAY=-20 DO $OUT[10]=TRUE\nLIN XP1",
  },
  FOLD: {
    description: {
      en: "KUKA Inline Form FOLD structure. Used on SmartPAD HMI to collapse motion and technology parameters into user-friendly graphical touch masks.",
      ru: "Структура Inline Form FOLD. Используется пультом KUKA SmartPAD для скрытия служебного кода за графическими масками оператора.",
      de: "Inlineformular-FOLD Struktur fuer die grafische KUKA SmartPAD-Oberflaeche.",
      es: "Estructura FOLD de KUKA para mascaras graficas en el SmartPAD.",
      it: "Struttura FOLD per le maschere grafiche dello SmartPAD.",
      tr: "SmartPAD ekranındaki grafik maskeleri olusturan Inline Form FOLD yapısı.",
    },
    syntax: ";FOLD PTP P1 Vel=100 % PDAT1 ...\n;ENDFOLD",
    example: ";FOLD PTP P1 Vel=100 % PDAT1 ;%{PE}%R 8.6.0\n$BWDSTART=FALSE\nPDAT_ACT=PPDAT1\nFDAT_ACT=FP1\nBAS(#PTP_PARAMS,100)\nPTP XP1\n;ENDFOLD",
  },
  WAIT: {
    description: {
      en: "Wait statement. Halts program execution until a time expires (WAIT SEC) or a boolean condition evaluates to TRUE (WAIT FOR). Always causes advance run stop.",
      ru: "Оператор ожидания. Приостанавливает программу на время (WAIT SEC) или до выполнения логического условия (WAIT FOR). Всегда вызывает останов پیشрасчета.",
      de: "Wartebefehl fuer Zeit (WAIT SEC) oder Bedingung (WAIT FOR). Loest Vorlaufstopp aus.",
      es: "Instruccion de espera por tiempo (WAIT SEC) o condicion booleana (WAIT FOR).",
      it: "Istruzione di attesa a tempo (WAIT SEC) o su condizione (WAIT FOR).",
      tr: "Zaman (WAIT SEC) veya kosul (WAIT FOR) bekleme komutu. Ileri hesaplamayı durdurur.",
    },
    syntax: "WAIT SEC RealSeconds\nWAIT FOR Condition",
    example: "WAIT SEC 0.5\nWAIT FOR $IN[1] == TRUE AND $IN[2] == FALSE",
  },
  CONTINUE: {
    description: {
      en: "Prevents the next instruction (e.g. $OUT, WAIT FOR, or arithmetic) from halting the advance run pointer ($ADVANCE), ensuring uninterrupted motion approximation.",
      ru: "Предотвращает останов предварительного расчета ($ADVANCE) на следующей за ней строке ($OUT, WAIT FOR, вычисления), сохраняя плавность движения.",
      de: "Verhindert den Vorlaufstopp fuer die unmittelbar folgende Anweisung.",
      es: "Evita la parada del avance para la instruccion inmediatamente posterior.",
      it: "Evita l'arresto del calcolo anticipato per l'istruzione successiva.",
      tr: "Bir sonraki satırdaki komutun ileri hesaplamayı ($ADVANCE) durdurmasını onler.",
    },
    syntax: "CONTINUE\n$OUT[1] = TRUE",
    example: "CONTINUE\nIF $IN[1] THEN\n  CONTINUE\n  $OUT[2] = TRUE\nENDIF",
  },
};

export function lookupSyntax(keyword: string, locale: Locale = "en"): KeywordDoc | undefined {
  const norm = keyword.toUpperCase().trim();
  return KRL_SYNTAX_DB[norm];
}
