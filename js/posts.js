const POSTS = [
  {
    id: "futuro-web",
    title: "Il futuro del web: semplicità e accessibilità",
    excerpt: "Come il design minimalista e l'accessibilità stanno ridefinendo l'esperienza online per tutti.",
    tag: "Tecnologia",
    color: "teal",
    date: "2026-05-28",
    author: "Marco Rossi",
    content: `
      <p>Il web sta attraversando una trasformazione silenziosa ma profonda. Non si tratta solo di nuove tecnologie o framework più veloci — è una ripensamento fondamentale di come costruire esperienze digitali che funzionano per tutti.</p>

      <h2>La semplicità come principio</h2>
      <p>Per decenni, abbiamo complicato il web con animazioni eccessive, popup invasivi e interfacce confuse. Oggi, i designer e gli sviluppatori più influenti stanno tornando alle basi: contenuto chiaro, navigazione intuitiva e performance eccellente.</p>

      <blockquote>Il miglior design è quello che non si nota — funziona così bene che diventa invisibile.</blockquote>

      <h2>Accessibilità non è un optional</h2>
      <p>L'accessibilità web non riguarda solo chi ha disabilità visive o motorie. Riguarda tutti: l'anziano che usa uno schermo grande, il pendolare che legge su un telefono in movimento, chi preferisce la navigazione da tastiera.</p>

      <p>Implementare l'accessibilità dal primo giorno non è più costoso — è più economico. Correggere problemi dopo il lancio costa molto di più.</p>

      <h2>Cosa possiamo fare oggi</h2>
      <ul>
        <li>Usare HTML semantico corretto</li>
        <li>Testare con screen reader e navigazione da tastiera</li>
        <li>Rispettare i contrasti di colore WCAG</li>
        <li>Ottimizzare le immagini e ridurre il JavaScript</li>
      </ul>

      <p>Il futuro del web è aperto, inclusivo e veloce. Sta a noi costruirlo.</p>
    `
  },
  {
    id: "rituali-mattutini",
    title: "Rituali mattutini che cambiano la giornata",
    excerpt: "Piccole abitudini che ho adottato per iniziare ogni mattina con energia e chiarezza mentale.",
    tag: "Vita",
    color: "rose",
    date: "2026-05-15",
    author: "Marco Rossi",
    content: `
      <p>La mattina è il momento più prezioso della giornata. Prima che le email arrivino, prima che le notifiche si accumulino, c'è uno spazio di quiete che possiamo usare per noi stessi.</p>

      <h2>Il mio rituale in cinque passi</h2>
      <p>Non serve un'ora — bastano venti minuti ben usati. Ecco cosa faccio ogni mattina, senza eccezioni:</p>

      <ul>
        <li><strong>5 minuti di stretching</strong> — sveglia il corpo senza stress</li>
        <li><strong>Un bicchiere d'acqua</strong> — prima del caffè, sempre</li>
        <li><strong>10 minuti di lettura</strong> — niente social, solo carta o ebook</li>
        <li><strong>3 obiettivi del giorno</strong> — scritti su un foglio, non in un'app</li>
        <li><strong>Una passeggiata breve</strong> — anche solo intorno al blocco</li>
      </ul>

      <blockquote>Non si tratta di produttività estrema. Si tratta di iniziare con intenzione.</blockquote>

      <h2>La chiave è la costanza</h2>
      <p>Ho provato decine di routine perfette trovate online. Quella che funziona è quella semplice, ripetuta ogni giorno. La perfezione non è l'obiettivo — la presenza è.</p>

      <p>Se vuoi iniziare, scegli un solo elemento e praticalo per una settimana. Poi aggiungi un altro. La trasformazione arriva lentamente, ma arriva.</p>
    `
  },
  {
    id: "design-tipografia",
    title: "Tipografia: l'arte che nessuno nota",
    excerpt: "Perché la scelta dei font e la gerarchia visiva sono fondamentali in ogni progetto digitale.",
    tag: "Design",
    color: "slate",
    date: "2026-05-02",
    author: "Marco Rossi",
    content: `
      <p>La tipografia è il fondamento silenzioso di ogni buon design. Quando funziona, il testo è leggibile, piacevole e guida l'occhio naturalmente. Quando fallisce, tutto il resto sembra sbagliato.</p>

      <h2>Due font, massimo tre</h2>
      <p>La regola classica regge ancora: un font per i titoli, uno per il corpo del testo. Un terzo, opzionale, per accenti o codice. Più font creano confusione visiva, non ricchezza.</p>

      <h2>La gerarchia conta più del font</h2>
      <p>Puoi usare lo stesso font per tutto e ottenere un design eccellente se la gerarchia è chiara: dimensioni diverse, pesi diversi, spaziatura consistente. L'occhio umano cerca pattern — dagli pattern chiari.</p>

      <blockquote>La tipografia è ciò che il design usa per parlare quando le immagini non bastano.</blockquote>

      <h2>Consigli pratici</h2>
      <ul>
        <li>Corpo del testo: 16–18px, line-height 1.6–1.8</li>
        <li>Limita la lunghezza delle righe a 60–75 caratteri</li>
        <li>Usa font system per performance, font custom per identità</li>
        <li>Testa sempre su mobile e desktop</li>
      </ul>

      <p>Investire tempo nella tipografia è uno dei migliori investimenti che puoi fare in qualsiasi progetto.</p>
    `
  },
  {
    id: "apprendimento-continuo",
    title: "Imparare senza burnout",
    excerpt: "Strategie per mantenere la curiosità e continuare a crescere senza esaurirsi.",
    tag: "Vita",
    color: "teal",
    date: "2026-04-18",
    author: "Marco Rossi",
    content: `
      <p>La cultura del "impara sempre" può diventare tossica se non gestita con consapevolezza. Non serve imparare tutto — serve imparare ciò che conta, nel modo giusto.</p>

      <h2>Il mito del polimatico moderno</h2>
      <p>Social e newsletter ci bombardano con nuovi framework, linguaggi e tendenze ogni settimana. La pressione per stare aggiornati è reale, ma la profondità batte sempre la superficialità.</p>

      <h2>La mia strategia</h2>
      <ul>
        <li>Un argomento principale per trimestre</li>
        <li>30 minuti al giorno, non di più</li>
        <li>Progetti pratici invece di corsi infiniti</li>
        <li>Pause deliberate — il cervello assimila durante il riposo</li>
      </ul>

      <blockquote>La curiosità sostenibile è meglio dell'ossessione temporanea.</blockquote>

      <p>Impara con gioia, non con ansia. Il resto seguirà.</p>
    `
  },
  {
    id: "open-source",
    title: "Contribuire all'open source: da dove iniziare",
    excerpt: "Una guida pratica per chi vuole dare il primo contributo a progetti open source.",
    tag: "Tecnologia",
    color: "rose",
    date: "2026-04-05",
    author: "Marco Rossi",
    content: `
      <p>L'open source sembra intimidatorio finché non fai il primo contributo. Poi capisci che dietro ogni grande progetto ci sono persone normali che rispondono a issue e revisionano pull request.</p>

      <h2>Primo passo: trovare il progetto giusto</h2>
      <p>Non inizia con React o Kubernetes. Inizia con un progetto che usi già, anche piccolo. Un tool CLI, una libreria che usi ogni giorno, un plugin del tuo editor.</p>

      <h2>Tipi di contributi per principianti</h2>
      <ul>
        <li>Correggere typo nella documentazione</li>
        <li>Tradurre README in altre lingue</li>
        <li>Aggiungere test per funzioni non coperte</li>
        <li>Rispondere a issue con domande semplici</li>
      </ul>

      <blockquote>Il miglior contributo open source è quello che qualcun altro può usare o imparare da.</blockquote>

      <h2>Il processo tipico</h2>
      <p>Leggi CONTRIBUTING.md, fork, branch, commit, pull request. Sii paziente con i maintainer — sono spesso volontari con poco tempo. Ringrazia sempre chi ti aiuta.</p>

      <p>Il tuo primo merge è un momento speciale. Non lo dimenticherai.</p>
    `
  },
  {
    id: "spazi-creativi",
    title: "Creare spazi che ispirano",
    excerpt: "Come l'ambiente fisico influisce sulla creatività e cosa ho cambiato nel mio studio.",
    tag: "Design",
    color: "slate",
    date: "2026-03-22",
    author: "Marco Rossi",
    content: `
      <p>Il luogo dove lavoriamo influenza profondamente come pensiamo. Uno spazio disordinato non è solo antiestetico — crea rumore mentale che riduce la capacità di concentrarsi.</p>

      <h2>Principi che ho applicato</h2>
      <p>Non servono ristrutturazioni costose. Piccoli cambiamenti fanno una grande differenza:</p>

      <ul>
        <li>Luce naturale il più possibile</li>
        <li>Un solo oggetto decorativo visibile — il resto in storage</li>
        <li>Verde: una pianta cambia l'atmosfera</li>
        <li>Separazione netta tra zona lavoro e zona riposo</li>
      </ul>

      <blockquote>Uno spazio ordinato non è sterile — è uno spazio dove le idee hanno spazio per respirare.</blockquote>

      <h2>Il digitale conta altrettanto</h2>
      <p>Desktop pulito, notifiche disattivate, un solo tab aperto quando possibile. Lo spazio digitale è il nostro studio moderno — trattalo con lo stesso rispetto.</p>
    `
  }
];

const TAGS = ["Tutti", ...new Set(POSTS.map(p => p.tag))];

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function getPostById(id) {
  return POSTS.find(p => p.id === id);
}

function getPostUrl(id) {
  return `post.html?id=${id}`;
}
