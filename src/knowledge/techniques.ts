/** Practical how-to text for every technique a compiled pattern can ask for. */
export interface Technique {
  id: string;
  name: { en: string; es: string };
  how: { en: string; es: string };
}

export const TECHNIQUES: Record<string, Technique> = {
  long_tail_cast_on: {
    id: 'long_tail_cast_on',
    name: { en: 'Long-tail cast on', es: 'Montaje de hebra larga' },
    how: {
      en: 'Leave a tail of about 3 cm per stitch. Make a slip knot on the needle. Hold the tail over your thumb and the ball yarn over your index finger. Bring the needle under the thumb strand, over the index strand, back through the thumb loop, then drop the thumb loop and tighten gently. Keep it loose: if the edge will not stretch around the head, cast on again over two needles held together.',
      es: 'Dejá una hebra de unos 3 cm por punto. Hacé un nudo corredizo en la aguja. Sostené la hebra suelta sobre el pulgar y la del ovillo sobre el índice. Pasá la aguja por debajo de la hebra del pulgar, por encima de la del índice, de vuelta por el lazo del pulgar, soltá el lazo y ajustá suave. Que quede flojo: si el borde no estira alrededor de la cabeza, volvé a montar sobre dos agujas juntas.',
    },
  },
  join_round: {
    id: 'join_round',
    name: { en: 'Join in the round without twisting', es: 'Unir en redondo sin retorcer' },
    how: {
      en: 'Lay the needle flat and make sure the cast-on edge sits on the inside of the circle all the way around, with no spiral. Place a marker on the right needle, then work the first stitch from the left needle snugly. A twist cannot be fixed later: check again before you finish the first round.',
      es: 'Apoyá la aguja plana y verificá que el borde montado quede hacia adentro del círculo en todo el recorrido, sin espirales. Colocá un marcador en la aguja derecha y tejé ajustado el primer punto de la aguja izquierda. Un retorcido no se arregla después: volvé a mirar antes de terminar la primera vuelta.',
    },
  },
  ssk: {
    id: 'ssk',
    name: { en: 'SSK: left-leaning decrease', es: 'SS: disminución hacia la izquierda' },
    how: {
      en: 'Slip one stitch knitwise, slip the next stitch knitwise, put the left needle through the front of both and knit them together through the back loops. Two stitches become one, leaning left.',
      es: 'Deslizá un punto como para tejerlo al derecho, deslizá el siguiente igual, pasá la aguja izquierda por delante de ambos y tejelos juntos por detrás. Dos puntos se vuelven uno, inclinado a la izquierda.',
    },
  },
  k2tog: {
    id: 'k2tog',
    name: { en: 'K2tog: right-leaning decrease', es: '2pjD: disminución hacia la derecha' },
    how: {
      en: 'Put the right needle through the next two stitches at once, from left to right, as if they were one, and knit. Two stitches become one, leaning right.',
      es: 'Pasá la aguja derecha por los dos puntos siguientes a la vez, de izquierda a derecha, como si fueran uno, y tejé al derecho. Dos puntos se vuelven uno, inclinado a la derecha.',
    },
  },
  p2tog: {
    id: 'p2tog',
    name: { en: 'P2tog: purl decrease', es: '2pjR: disminución al revés' },
    how: {
      en: 'With the yarn in front, put the right needle through the next two stitches from right to left and purl them as one.',
      es: 'Con la hebra adelante, pasá la aguja derecha por los dos puntos siguientes de derecha a izquierda y tejelos juntos al revés.',
    },
  },
  ssp: {
    id: 'ssp',
    name: { en: 'SSP: purl decrease leaning the other way', es: 'SSR: disminución al revés inclinada al otro lado' },
    how: {
      en: 'Slip two stitches knitwise one at a time, return them to the left needle without twisting, then purl both together through the back loops.',
      es: 'Deslizá dos puntos de a uno como al derecho, devolvelos a la aguja izquierda sin retorcerlos y tejelos juntos al revés por la hebra de atrás.',
    },
  },
  m1l: {
    id: 'm1l',
    name: { en: 'M1L: left-leaning increase', es: 'A1I: aumento hacia la izquierda' },
    how: {
      en: 'Lift the bar between the needles from front to back with the left needle, then knit it through the back loop so that no hole forms.',
      es: 'Levantá la hebra entre las agujas de adelante hacia atrás con la aguja izquierda y tejela por la hebra de atrás para que no quede agujero.',
    },
  },
  m1r: {
    id: 'm1r',
    name: { en: 'M1R: right-leaning increase', es: 'A1D: aumento hacia la derecha' },
    how: {
      en: 'Lift the bar between the needles from back to front with the left needle, then knit it through the front loop so that no hole forms.',
      es: 'Levantá la hebra entre las agujas de atrás hacia adelante con la aguja izquierda y tejela por la hebra de adelante para que no quede agujero.',
    },
  },
  k1b: {
    id: 'k1b',
    name: { en: 'K1b: knit one in the row below', es: 'D1A: derecho en la vuelta de abajo' },
    how: {
      en: 'Instead of the stitch on the needle, put the right needle through the centre of the stitch directly below it and knit. Let the stitch above slide off: it unravels onto the new stitch and makes the plump rib.',
      es: 'En lugar del punto de la aguja, pasá la aguja derecha por el centro del punto que está justo debajo y tejé al derecho. Dejá caer el punto de arriba: se apoya sobre el nuevo y da el relieve del elástico inglés.',
    },
  },
  chain_selvedge: {
    id: 'chain_selvedge',
    name: { en: 'Chain selvedge', es: 'Orillo de cadeneta' },
    how: {
      en: 'At the start of every row slip the first stitch as if to purl with the yarn in front, then move the yarn to where the next stitch needs it. Knit the last stitch of every row. The edge becomes a neat chain with one chain per two rows.',
      es: 'Al empezar cada hilera deslizá el primer punto como al revés con la hebra adelante y llevá la hebra adonde la necesite el siguiente punto. Tejé al derecho el último punto de cada hilera. El borde queda como una cadeneta prolija, con un eslabón cada dos hileras.',
    },
  },
  stretchy_bind_off: {
    id: 'stretchy_bind_off',
    name: { en: 'Stretchy bind off', es: 'Cierre elástico' },
    how: {
      en: 'Work two stitches in pattern, slip them back to the left needle and knit them together through the back loops. One stitch is now on the right needle. Work the next stitch, slip both back and repeat. It stays as elastic as the fabric.',
      es: 'Tejé dos puntos como se presentan, devolvelos a la aguja izquierda y tejelos juntos por detrás. Queda un punto en la aguja derecha. Tejé el siguiente, devolvé ambos y repetí. Queda tan elástico como el tejido.',
    },
  },
  drawstring_close: {
    id: 'drawstring_close',
    name: { en: 'Close the top like a drawstring', es: 'Cerrar la punta como un cordón' },
    how: {
      en: 'Cut the yarn leaving 20 cm. Thread it on a tapestry needle and pass it through every stitch still on the needle, taking them off as you go. Go round a second time, pull firmly, push the needle to the inside and fasten off with a few small stitches.',
      es: 'Cortá la hebra dejando 20 cm. Enhebrala en la aguja lanera y pasala por todos los puntos que quedan, sacándolos de la aguja. Dá una segunda pasada, tirá firme, llevá la aguja hacia adentro y rematá con unas puntadas pequeñas.',
    },
  },
  mattress_seam: {
    id: 'mattress_seam',
    name: { en: 'Mattress seam', es: 'Costura invisible' },
    how: {
      en: 'Lay the edges side by side with the right side up. Pass the tapestry needle under the two bars between the edge stitch and its neighbour on one side, then the same on the other side. Every few stitches pull gently: the seam closes and disappears.',
      es: 'Apoyá los bordes uno al lado del otro con el derecho hacia arriba. Pasá la aguja lanera por debajo de las dos hebras entre el punto de borde y su vecino de un lado, y lo mismo del otro. Cada pocos puntos tirá suave: la costura se cierra y desaparece.',
    },
  },
  jogless_stripes: {
    id: 'jogless_stripes',
    name: { en: 'Hide the step at colour changes', es: 'Disimular el escalón en los cambios de color' },
    how: {
      en: 'Knitting in the round is a spiral, so a horizontal stripe does not meet itself. Knit one full round in the new colour. At the start of the next round slip the first stitch purlwise, then carry on. The marker stays where it is.',
      es: 'Tejer en redondo es una espiral, así que la raya horizontal no empalma. Tejé una vuelta completa con el color nuevo. Al empezar la siguiente deslizá el primer punto como al revés y seguí. El marcador queda donde estaba.',
    },
  },
  stranded_floats: {
    id: 'stranded_floats',
    name: { en: 'Carry the unused colour behind', es: 'Llevar por detrás el color que no se usa' },
    how: {
      en: 'Work with both yarns attached, always carrying the unused one loosely across the back. Spread the stitches on the right needle before each change so that the fabric stays stretchy. If a colour rests for more than 5 stitches, twist the two yarns once at the back to trap it.',
      es: 'Trabajá con ambas hebras unidas, llevando siempre floja por detrás la que no se usa. Antes de cada cambio estirá los puntos de la aguja derecha para que el tejido siga elástico. Si un color descansa más de 5 puntos, cruzá las dos hebras una vez por detrás para sujetarlo.',
    },
  },
  gauge_swatch: {
    id: 'gauge_swatch',
    name: { en: 'Measure a swatch', es: 'Medir una muestra' },
    how: {
      en: 'Wash or steam the swatch the way you will treat the finished piece and let it dry flat. Do not stretch it. Lay a ruler across the middle, away from the edges, and count the stitches in 10 cm including half stitches. Do the same up the fabric for rows.',
      es: 'Lavá o vaporizá la muestra como vas a tratar la prenda y dejala secar plana. No la estires. Apoyá una regla en el medio, lejos de los bordes, y contá los puntos en 10 cm, incluidos los medios puntos. Hacé lo mismo a lo alto para las vueltas.',
    },
  },
};
