/* =====================================================================
   PLANER GABINETU — moduł kliniczny
   Szablony wywiadu pierwszej wizyty, skale przesiewowe, reguły hipotez,
   kody ICD-10 i ICD-11. Tylko wiedza ogólna — żadnych danych pacjentów.

   UWAGA KLINICZNA: reguły tworzą HIPOTEZY do weryfikacji przez psychologa,
   nie rozpoznania. Kierunki pracy oparte na wytycznych NICE / WHO (mhGAP)
   i Kodzie diagnozy PTP — do aktualizacji przez użytkowniczkę.
   PHQ-9 i GAD-7 (Pfizer) są bezpłatne w użyciu; brzmienie pozycji porównaj
   z oficjalną polską wersją na www.phqscreeners.com.
   ICD-11: nazwy polskie robocze — oficjalne tłumaczenie publikuje Centrum e-Zdrowia.
   ===================================================================== */
"use strict";
const KLIN = (() => {

/* ---------- skale ---------- */
const PHQ9 = {
  name: 'PHQ-9', intro: 'Jak często w ciągu ostatnich 2 tygodni dokuczały Panu/Pani następujące problemy?',
  opts: ['wcale nie dokuczały', 'kilka dni', 'więcej niż połowę dni', 'niemal codziennie'],
  items: [
    'Niewielkie zainteresowanie lub odczuwanie przyjemności z wykonywania czynności',
    'Uczucie smutku, przygnębienia lub beznadziejności',
    'Kłopoty z zaśnięciem lub przerywany sen, albo zbyt długi sen',
    'Uczucie zmęczenia lub brak energii',
    'Brak apetytu lub przejadanie się',
    'Poczucie niezadowolenia z siebie — lub uczucie, że jest się do niczego, albo że zawiódł/zawiodła Pan/Pani siebie lub rodzinę',
    'Problemy ze skupieniem się na przykład przy czytaniu gazety lub oglądaniu telewizji',
    'Poruszanie się lub mówienie tak wolno, że inni mogliby to zauważyć? Albo wręcz przeciwnie — niemożność usiedzenia w miejscu lub podenerwowanie powodujące ruchliwość znacznie większą niż zwykle',
    'Myśli, że lepiej byłoby umrzeć, albo chęć zrobienia sobie jakiejś krzywdy'
  ],
  bands: [[0, 'minimalne'], [5, 'łagodne'], [10, 'umiarkowane'], [15, 'umiarkowanie ciężkie'], [20, 'ciężkie']],
  src: 'Polska wersja PHQ-9 (Kokoszka, Jastrzębski, Obrębski, Psychiatria 2016;13(4):187–193). Opracowanie: R.L. Spitzer, J.B.W. Williams, K. Kroenke i wsp., grant Pfizer Inc.'
};
const GAD7 = {
  name: 'GAD-7', intro: 'Jak często w ciągu ostatnich 2 tygodni dokuczały Panu(i) następujące problemy?',
  opts: PHQ9.opts,
  items: [
    'Czuł(a) się Pan(i) podenerwowany(a), niespokojny(a), mocno spięty(a)',
    'Nie mógł(a) Pan(i) przestać się martwić albo zapanować nad tym',
    'Za bardzo się Pan(i) martwił(a) różnymi rzeczami',
    'Miał(a) Pan(i) trudności z relaksowaniem się',
    'Był(a) Pan(i) tak niespokojny(a), że nie mógł(a) usiedzieć na miejscu',
    'Łatwo stawał(a) się Pan(i) rozdrażniony(a) lub poirytowany(a)',
    'Obawiał(a) się Pan(i), tak jakby miało się stać coś strasznego'
  ],
  bands: [[0, 'minimalne'], [5, 'łagodne'], [10, 'umiarkowane'], [15, 'ciężkie']],
  src: 'Polska wersja GAD-7. Opracowanie: R.L. Spitzer, J.B.W. Williams, K. Kroenke i wsp., grant Pfizer Inc. Zgoda na powielanie nie jest wymagana.'
};
const band = (sc, s) => { let r = sc.bands[0][1]; for (const [min, t] of sc.bands) if (s >= min) r = t; return r };

/* ---------- szablony wywiadu ----------
   typy pól: text | sel (opcje) | chk | num | phq | gad
*/
const DUR = ['krócej niż 2 tygodnie', '2 tygodnie – 1 miesiąc', '1–6 miesięcy', '6 miesięcy – 2 lata', 'ponad 2 lata'];
const IMPAIR = ['brak', 'łagodne', 'umiarkowane', 'znaczne'];
const TEMPLATES = {
  dorosly: {
    name: 'Dorosły – pierwsza konsultacja',
    sections: [
      { t: 'Zgłoszenie', f: [
        ['reason_own', 'Powód zgłoszenia – słowami pacjenta', 'text'],
        ['expect', 'Czego oczekuje od spotkań', 'text'],
        ['source', 'Z czyjej inicjatywy', 'sel', ['własnej', 'rodziny / partnera', 'lekarza', 'pracodawcy', 'instytucji / sądu']],
        ['prev_help', 'Wcześniejsza pomoc', 'sel', ['nie korzystał/a', 'psycholog / psychoterapia', 'psychiatra', 'hospitalizacja psychiatryczna']],
        ['meds', 'Przyjmowane leki', 'text']
      ]},
      { t: 'Sytuacja życiowa', f: [
        ['family', 'Rodzina, związek, mieszkanie', 'text'],
        ['work', 'Praca / nauka', 'text'],
        ['changes', 'Ważne zmiany w ostatnim roku', 'text'],
        ['support', 'Wsparcie bliskich', 'sel', ['dobre', 'ograniczone', 'brak']],
        ['health', 'Zdrowie somatyczne, sen, aktywność', 'text']
      ]},
      { t: 'Nastrój', f: [
        ['m_low', 'Obniżony nastrój większość dnia', 'chk'], ['m_anh', 'Utrata zainteresowań / przyjemności', 'chk'],
        ['m_energy', 'Spadek energii, męczliwość', 'chk'], ['m_guilt', 'Poczucie winy / bezwartościowości', 'chk'],
        ['m_conc', 'Trudności z koncentracją, decyzjami', 'chk'], ['m_appetite', 'Zmiany apetytu lub wagi', 'chk'],
        ['m_hopeless', 'Pesymizm, beznadzieja', 'chk'], ['m_prior', 'Wcześniejsze epizody obniżonego nastroju', 'chk'],
        ['m_years2', 'Obniżony nastrój przez większość dni od co najmniej 2 lat', 'chk'],
        ['m_dur', 'Czas trwania obecnych objawów', 'sel', DUR]
      ]},
      { t: 'Lęk', f: [
        ['a_worry', 'Nadmierne, trudne do kontrolowania zamartwianie', 'chk'], ['a_tension', 'Napięcie, niepokój ruchowy, drażliwość', 'chk'],
        ['a_panic', 'Nagłe napady silnego lęku z objawami z ciała', 'chk'], ['a_panic_fear', 'Obawa przed kolejnym napadem / zmiana zachowania', 'chk'],
        ['a_agora', 'Unikanie wychodzenia, tłumu, komunikacji', 'chk'], ['a_social', 'Silny lęk w sytuacjach społecznych, unikanie', 'chk'],
        ['a_specific', 'Silny lęk przed konkretnym obiektem / sytuacją', 'chk'],
        ['a_dur', 'Czas trwania lęku', 'sel', DUR]
      ]},
      { t: 'Stres i trauma', f: [
        ['t_event', 'Doświadczenie zdarzenia traumatycznego', 'chk'], ['t_intrusion', 'Natrętne wspomnienia, koszmary, flashbacki', 'chk'],
        ['t_avoid', 'Unikanie przypomnień o zdarzeniu', 'chk'], ['t_hyper', 'Nadmierna czujność, łatwe przestraszenie', 'chk'],
        ['t_self', 'Trwałe trudności z regulacją emocji, obrazem siebie, relacjami', 'chk'],
        ['t_recent', 'Wyraźny stresor w ostatnich miesiącach (strata pracy, rozstanie, choroba)', 'chk'],
        ['t_adjust', 'Zaabsorbowanie stresorem i trudność w przystosowaniu', 'chk'],
        ['t_grief', 'Żałoba trwająca ponad 6 miesięcy z silną tęsknotą i cierpieniem', 'chk']
      ]},
      { t: 'Inne obszary', f: [
        ['o_obs', 'Natrętne myśli, których trudno się pozbyć', 'chk'], ['o_comp', 'Czynności przymusowe (sprawdzanie, mycie, liczenie)', 'chk'],
        ['s_insomnia', 'Trudności ze snem co najmniej 3 noce w tygodniu', 'chk'], ['s_3m', 'Problemy ze snem trwają ponad 3 miesiące', 'chk'],
        ['b_exhaust', 'Wyczerpanie związane z pracą', 'chk'], ['b_cynic', 'Dystans, cynizm wobec pracy', 'chk'], ['b_eff', 'Spadek skuteczności w pracy', 'chk'],
        ['u_alcohol', 'Ryzykowne picie alkoholu', 'chk'], ['u_control', 'Utrata kontroli nad piciem / głód', 'chk'],
        ['u_drugs', 'Używanie innych substancji', 'chk'], ['u_gambling', 'Hazard', 'chk'], ['u_gaming', 'Nadmierne granie / internet', 'chk'],
        ['e_restrict', 'Restrykcje jedzenia, lęk przed przytyciem', 'chk'], ['e_binge', 'Napady objadania się', 'chk'], ['e_comp', 'Zachowania kompensacyjne (wymioty, środki)', 'chk'],
        ['d_child', 'Trudności z uwagą i organizacją od dzieciństwa', 'chk'], ['d_impuls', 'Impulsywność, niecierpliwość', 'chk'],
        ['so_somatic', 'Dolegliwości z ciała bez wyjaśnienia medycznego, absorbujące', 'chk'],
        ['r_conflict', 'Kryzys w związku', 'chk'], ['r_parenting', 'Trudności wychowawcze', 'chk']
      ]},
      { t: 'Sygnały do pilnej konsultacji', f: [
        ['x_mania', 'Okresy podwyższonego nastroju / mniejszej potrzeby snu (≥4 dni)', 'chk'],
        ['x_psych', 'Słyszenie głosów, niezwykłe przekonania', 'chk'],
        ['x_memory', 'Nowe problemy z pamięcią, orientacją', 'chk'],
        ['r_violence', 'Doświadcza przemocy', 'chk']
      ]},
      { t: 'Bezpieczeństwo', f: [
        ['k_passive', 'Myśli rezygnacyjne („lepiej by mnie nie było”)', 'chk'],
        ['k_ideation', 'Myśli samobójcze w ostatnim miesiącu', 'chk'],
        ['k_plan', 'Plan lub zamiar', 'chk'],
        ['k_attempt', 'Próba samobójcza w przeszłości', 'chk'],
        ['k_selfharm', 'Samookaleczenia', 'chk'],
        ['k_means', 'Dostęp do środków', 'chk'],
        ['k_protect', 'Czynniki chroniące (osoby, powody do życia)', 'text']
      ]},
      { t: 'Funkcjonowanie i zasoby', f: [
        ['f_impair', 'Wpływ trudności na codzienne funkcjonowanie', 'sel', IMPAIR],
        ['resources', 'Mocne strony, zasoby, zainteresowania', 'text'],
        ['motivation', 'Motywacja do zmiany (1–10)', 'num']
      ]},
      { t: 'PHQ-9', f: [['phq', '', 'phq']] },
      { t: 'GAD-7', f: [['gad', '', 'gad']] }
    ]
  },
  dziecko: {
    name: 'Dziecko / nastolatek – wywiad z rodzicem',
    sections: [
      { t: 'Zgłoszenie', f: [
        ['age', 'Wiek dziecka (lata)', 'num'], ['class', 'Klasa / przedszkole', 'text'],
        ['reason_own', 'Powód zgłoszenia – słowami rodzica', 'text'], ['child_view', 'Jak widzi to dziecko', 'text'],
        ['expect', 'Oczekiwania rodzica', 'text'],
        ['source', 'Z czyjej inicjatywy', 'sel', ['rodzica', 'szkoły / przedszkola', 'poradni (PPP)', 'lekarza', 'sądu / instytucji']],
        ['opinions', 'Dotychczasowe opinie, orzeczenia, diagnozy', 'text']
      ]},
      { t: 'Rozwój i zdrowie', f: [
        ['preg', 'Ciąża i poród', 'text'], ['milestones', 'Rozwój ruchowy i mowy', 'text'],
        ['health', 'Zdrowie, leki, sen', 'text'], ['screens', 'Czas przed ekranem', 'text']
      ]},
      { t: 'Rodzina i szkoła', f: [
        ['family', 'Rodzina, zmiany (rozwód, przeprowadzka, strata)', 'text'],
        ['school', 'Funkcjonowanie w szkole, oceny, opinia nauczycieli', 'text'],
        ['peers', 'Relacje z rówieśnikami', 'text']
      ]},
      { t: 'Uwaga i zachowanie', f: [
        ['c_inatt', 'Trudności z uwagą, gubienie rzeczy, nieuważność', 'chk'], ['c_hyper', 'Nadruchliwość', 'chk'],
        ['c_impuls', 'Impulsywność, przerywanie, trudność z czekaniem', 'chk'], ['c_two', 'Trudności widoczne w domu i w szkole', 'chk'],
        ['c_defiant', 'Sprzeciw, kłótliwość, łamanie poleceń', 'chk'], ['c_anger', 'Częste napady złości', 'chk'],
        ['c_aggr', 'Agresja, niszczenie, poważne łamanie zasad', 'chk']
      ]},
      { t: 'Emocje', f: [
        ['c_sep', 'Silny lęk przy rozstaniu z rodzicem', 'chk'], ['c_worry', 'Zamartwianie się', 'chk'],
        ['c_fears', 'Silne lęki przed konkretnymi rzeczami', 'chk'], ['c_social', 'Lęk w sytuacjach społecznych', 'chk'],
        ['c_mutism', 'Nie mówi w niektórych sytuacjach (np. w szkole)', 'chk'],
        ['c_mood', 'Smutek lub drażliwość przez większość dni', 'chk'], ['c_anh', 'Utrata zainteresowań', 'chk'],
        ['c_trauma', 'Trudne / traumatyczne wydarzenie', 'chk']
      ]},
      { t: 'Rozwój społeczny, mowa, nauka', f: [
        ['c_soc', 'Trudności w kontakcie i komunikacji społecznej', 'chk'], ['c_rigid', 'Sztywne zachowania, wąskie zainteresowania', 'chk'],
        ['c_sensory', 'Nadwrażliwości zmysłowe', 'chk'], ['c_speech', 'Opóźnienie lub trudności mowy', 'chk'],
        ['c_learning', 'Trudności w czytaniu, pisaniu lub liczeniu', 'chk'],
        ['c_tics', 'Tiki', 'chk'], ['c_enuresis', 'Moczenie po 5. roku życia', 'chk'], ['c_eating', 'Niepokojące jedzenie / waga', 'chk'],
        ['c_bully', 'Przemoc rówieśnicza / odrzucenie', 'chk'], ['c_gaming', 'Problem z grami / telefonem', 'chk']
      ]},
      { t: 'Bezpieczeństwo', f: [
        ['k_ideation', 'Wypowiedzi lub myśli o śmierci / samobójstwie', 'chk'],
        ['k_selfharm', 'Samookaleczenia', 'chk'],
        ['k_harm', 'Podejrzenie krzywdzenia dziecka', 'chk'],
        ['k_protect', 'Czynniki chroniące', 'text']
      ]},
      { t: 'Funkcjonowanie i zasoby', f: [
        ['f_impair', 'Wpływ trudności na funkcjonowanie', 'sel', IMPAIR],
        ['resources', 'Mocne strony dziecka i rodziny', 'text']
      ]},
      { t: 'PHQ-9 (nastolatek 12+, opcjonalnie)', f: [['phq', '', 'phq']] },
      { t: 'GAD-7 (nastolatek 12+, opcjonalnie)', f: [['gad', '', 'gad']] }
    ]
  }
};

/* ---------- kody ICD ---------- */
const ICD10 = [
['F00','Otępienie w chorobie Alzheimera'],['F01','Otępienie naczyniowe'],['F02','Otępienie w przebiegu innych chorób'],['F03','Otępienie, nieokreślone'],
['F04','Organiczny zespół amnestyczny niewywołany przez alkohol i inne substancje'],['F05','Majaczenie niewywołane przez alkohol i inne substancje'],
['F06','Inne zaburzenia psychiczne spowodowane uszkodzeniem lub dysfunkcją mózgu i chorobą somatyczną'],['F06.7','Łagodne zaburzenia poznawcze'],
['F07','Zaburzenia osobowości i zachowania spowodowane chorobą, uszkodzeniem i dysfunkcją mózgu'],['F09','Nieokreślone organiczne lub objawowe zaburzenia psychiczne'],
['F10','Zaburzenia psychiczne i zachowania spowodowane użyciem alkoholu'],['F10.1','Alkohol – używanie szkodliwe'],['F10.2','Alkohol – zespół uzależnienia'],
['F11','Zaburzenia spowodowane użyciem opioidów'],['F12','Zaburzenia spowodowane użyciem kannabinoidów'],['F13','Zaburzenia spowodowane użyciem leków uspokajających i nasennych'],
['F14','Zaburzenia spowodowane używaniem kokainy'],['F15','Zaburzenia spowodowane używaniem innych substancji stymulujących, w tym kofeiny'],
['F16','Zaburzenia spowodowane używaniem halucynogenów'],['F17','Zaburzenia spowodowane paleniem tytoniu'],['F18','Zaburzenia spowodowane odurzaniem się lotnymi rozpuszczalnikami'],
['F19','Zaburzenia spowodowane używaniem wielu substancji psychoaktywnych'],
['F20','Schizofrenia'],['F21','Zaburzenie schizotypowe'],['F22','Uporczywe zaburzenia urojeniowe'],['F23','Ostre i przemijające zaburzenia psychotyczne'],
['F24','Indukowane zaburzenie urojeniowe'],['F25','Zaburzenia schizoafektywne'],['F28','Inne nieorganiczne zaburzenia psychotyczne'],['F29','Nieokreślona psychoza nieorganiczna'],
['F30','Epizod maniakalny'],['F31','Zaburzenia afektywne dwubiegunowe'],['F32','Epizod depresyjny'],['F32.0','Epizod depresji łagodny'],['F32.1','Epizod depresji umiarkowany'],
['F32.2','Epizod depresji ciężki bez objawów psychotycznych'],['F32.3','Epizod depresji ciężki z objawami psychotycznymi'],
['F33','Zaburzenia depresyjne nawracające'],['F33.0','Zaburzenie depresyjne nawracające, obecnie epizod łagodny'],['F33.1','Zaburzenie depresyjne nawracające, obecnie epizod umiarkowany'],
['F33.2','Zaburzenie depresyjne nawracające, obecnie epizod ciężki bez objawów psychotycznych'],['F34','Uporczywe zaburzenia nastroju [afektywne]'],['F34.0','Cyklotymia'],['F34.1','Dystymia'],
['F38','Inne zaburzenia nastroju [afektywne]'],['F39','Zaburzenia nastroju [afektywne], nieokreślone'],
['F40','Zaburzenia lękowe w postaci fobii'],['F40.0','Agorafobia'],['F40.1','Fobie społeczne'],['F40.2','Specyficzne (izolowane) postacie fobii'],
['F41','Inne zaburzenia lękowe'],['F41.0','Zaburzenie lękowe z napadami lęku [lęk paniczny]'],['F41.1','Zaburzenie lękowe uogólnione'],['F41.2','Zaburzenie depresyjne i lękowe mieszane'],
['F42','Zaburzenie obsesyjno-kompulsyjne'],['F43','Reakcja na ciężki stres i zaburzenia adaptacyjne'],['F43.0','Ostra reakcja na stres'],['F43.1','Zaburzenie stresowe pourazowe'],['F43.2','Zaburzenia adaptacyjne'],
['F44','Zaburzenia dysocjacyjne [konwersyjne]'],['F45','Zaburzenia występujące pod postacią somatyczną'],['F48','Inne zaburzenia nerwicowe'],['F48.0','Neurastenia'],
['F50','Zaburzenia odżywiania się'],['F50.0','Jadłowstręt psychiczny'],['F50.2','Żarłoczność psychiczna'],['F51','Nieorganiczne zaburzenia snu'],['F51.0','Bezsenność nieorganiczna'],
['F52','Dysfunkcja seksualna niespowodowana zaburzeniem somatycznym ani chorobą'],['F53','Zaburzenia psychiczne i zachowania związane z połogiem'],
['F54','Czynniki psychologiczne i behawioralne związane z zaburzeniami lub chorobami klasyfikowanymi gdzie indziej'],['F55','Nadużywanie substancji niepowodujących uzależnienia'],
['F59','Nieokreślone zespoły behawioralne związane z zaburzeniami fizjologicznymi i czynnikami fizycznymi'],
['F60','Specyficzne zaburzenia osobowości'],['F60.3','Osobowość chwiejna emocjonalnie'],['F61','Zaburzenia osobowości mieszane i inne'],['F62','Trwałe zmiany osobowości niewynikające z uszkodzenia ani choroby mózgu'],
['F63','Zaburzenia nawyków i popędów'],['F63.0','Patologiczny hazard'],['F63.8','Inne zaburzenia nawyków i popędów'],['F64','Zaburzenia identyfikacji płciowej'],
['F65','Zaburzenia preferencji seksualnych'],['F66','Zaburzenia psychologiczne i zachowania związane z rozwojem i orientacją seksualną'],['F68','Inne zaburzenia osobowości i zachowania dorosłych'],['F69','Nieokreślone zaburzenia osobowości i zachowania dorosłych'],
['F70','Upośledzenie umysłowe lekkie'],['F71','Upośledzenie umysłowe umiarkowane'],['F72','Upośledzenie umysłowe znaczne'],['F73','Upośledzenie umysłowe głębokie'],['F78','Inne upośledzenie umysłowe'],['F79','Nieokreślone upośledzenie umysłowe'],
['F80','Specyficzne zaburzenia rozwoju mowy i języka'],['F81','Specyficzne zaburzenia rozwoju umiejętności szkolnych'],['F82','Specyficzne zaburzenia rozwojowe funkcji motorycznych'],
['F83','Mieszane specyficzne zaburzenia rozwojowe'],['F84','Całościowe zaburzenia rozwojowe'],['F84.0','Autyzm dziecięcy'],['F84.1','Autyzm atypowy'],['F84.5','Zespół Aspergera'],
['F88','Inne zaburzenia rozwoju psychologicznego'],['F89','Nieokreślone zaburzenia rozwoju psychologicznego'],
['F90','Zaburzenia hiperkinetyczne'],['F90.0','Zaburzenie aktywności i uwagi'],['F91','Zaburzenia zachowania'],['F91.3','Zaburzenie opozycyjno-buntownicze'],
['F92','Mieszane zaburzenia zachowania i emocji'],['F93','Zaburzenia emocjonalne rozpoczynające się zwykle w dzieciństwie'],['F93.0','Zaburzenie lękowe przebiegające z lękiem przed separacją w dzieciństwie'],['F93.8','Inne zaburzenia emocjonalne rozpoczynające się zwykle w dzieciństwie'],
['F94','Zaburzenia funkcjonowania społecznego rozpoczynające się zwykle w dzieciństwie i w wieku młodzieńczym'],['F94.0','Mutyzm wybiórczy'],['F95','Tiki'],
['F98','Inne zaburzenia zachowania i emocji rozpoczynające się zwykle w dzieciństwie i w wieku młodzieńczym'],['F98.0','Moczenie mimowolne nieorganiczne'],['F98.1','Nieorganiczne zanieczyszczanie się kałem'],
['F99','Zaburzenia psychiczne bez innego określenia'],
['Z03.2','Obserwacja w kierunku podejrzewanych zaburzeń psychicznych i zaburzeń zachowania'],['Z55','Problemy związane z kształceniem i umiejętnością czytania i pisania'],
['Z56','Problemy związane z zatrudnieniem i bezrobociem'],['Z60.4','Wykluczenie społeczne i odrzucenie'],['Z61','Problemy związane z negatywnymi wydarzeniami w dzieciństwie'],
['Z62','Inne problemy związane z wychowaniem'],['Z63.0','Problemy w relacjach z partnerem lub małżonkiem'],['Z63.4','Zaginięcie lub zgon członka rodziny'],
['Z63.5','Rozpad rodziny przez separację lub rozwód'],['Z73.0','Wyczerpanie życiowe [wypalenie]'],['Z71.9','Poradnictwo, nieokreślone']
];
const ICD11 = [
['6A00','Zaburzenia rozwoju intelektualnego'],['6A01','Rozwojowe zaburzenia mowy lub języka'],['6A02','Zaburzenie ze spektrum autyzmu'],['6A03','Rozwojowe zaburzenie uczenia się'],
['6A04','Rozwojowe zaburzenie koordynacji ruchowej'],['6A05','Zaburzenie deficytu uwagi z nadruchliwością (ADHD)'],['6A06','Zaburzenie ruchów stereotypowych'],
['6A20','Schizofrenia'],['6A21','Zaburzenie schizoafektywne'],['6A22','Zaburzenie schizotypowe'],['6A23','Ostre i przemijające zaburzenie psychotyczne'],['6A24','Zaburzenie urojeniowe'],
['6A60','Zaburzenie dwubiegunowe typu I'],['6A61','Zaburzenie dwubiegunowe typu II'],['6A62','Cyklotymia'],
['6A70','Zaburzenie depresyjne z pojedynczym epizodem'],['6A71','Nawracające zaburzenie depresyjne'],['6A72','Dystymia'],['6A73','Mieszane zaburzenie depresyjne i lękowe'],
['6B00','Zaburzenie lękowe uogólnione'],['6B01','Zaburzenie paniczne'],['6B02','Agorafobia'],['6B03','Fobia specyficzna'],['6B04','Zaburzenie lęku społecznego'],
['6B05','Zaburzenie lęku separacyjnego'],['6B06','Mutyzm wybiórczy'],
['6B20','Zaburzenie obsesyjno-kompulsyjne'],['6B21','Zaburzenie dysmorficzne ciała'],['6B22','Hipochondria'],['6B24','Zbieractwo'],['6B25','Zaburzenia powtarzalnych zachowań skoncentrowanych na ciele'],
['6B40','Zaburzenie stresowe pourazowe (PTSD)'],['6B41','Złożone zaburzenie stresowe pourazowe (CPTSD)'],['6B42','Zaburzenie przedłużonej żałoby'],['6B43','Zaburzenie adaptacyjne'],
['6B44','Reaktywne zaburzenie przywiązania'],['6B45','Zaburzenie rozhamowanego zaangażowania społecznego'],
['6B60','Dysocjacyjne zaburzenie z objawami neurologicznymi'],['6B64','Dysocjacyjne zaburzenie tożsamości'],['6B66','Zaburzenie depersonalizacji-derealizacji'],
['6B80','Jadłowstręt psychiczny'],['6B81','Bulimia psychiczna'],['6B82','Zaburzenie z napadami objadania się'],['6B83','Zaburzenie z unikaniem/ograniczaniem przyjmowania pokarmów (ARFID)'],
['6C00','Moczenie'],['6C01','Zanieczyszczanie się kałem'],['6C20','Zaburzenie z dystresem cielesnym'],
['6C40','Zaburzenia związane z używaniem alkoholu'],['6C41','Zaburzenia związane z używaniem kannabinoidów'],['6C4A','Zaburzenia związane z używaniem nikotyny'],
['6C50','Zaburzenie hazardowe'],['6C51','Zaburzenie związane z graniem w gry'],['6C72','Zaburzenie kompulsywnych zachowań seksualnych'],['6C73','Przerywane zaburzenie wybuchowe'],
['6C90','Zaburzenie opozycyjno-buntownicze'],['6C91','Zaburzenie zachowania z cechami dyssocjalnymi'],
['6D10','Zaburzenie osobowości'],['6D11','Wyraźne cechy lub wzorce osobowości'],['6D11.5','Wzorzec borderline'],
['6D70','Majaczenie'],['6D71','Łagodne zaburzenie neuropoznawcze'],['6D80','Otępienie w przebiegu choroby Alzheimera'],
['6E20','Zaburzenia psychiczne związane z ciążą, porodem lub połogiem, bez objawów psychotycznych'],['6E40','Czynniki psychologiczne lub behawioralne wpływające na choroby sklasyfikowane gdzie indziej'],
['7A00','Przewlekła bezsenność'],['7A01','Krótkotrwała bezsenność'],['8A05','Pierwotne tiki lub zaburzenia tikowe'],
['QD85','Wypalenie zawodowe (zjawisko związane z pracą – nie choroba)'],['QE84','Ostra reakcja na stres (nie zaburzenie)']
];
/* DSM-5-TR: nazwy rozpoznań i kody ICD-10-CM (bez tekstu kryteriów – chronione prawem autorskim APA).
   Nazwy polskie zbliżone do polskiego wydania; podkody z „x” uzupełnij wg specyfikatorów. */
const DSM5 = [
['F70','Niepełnosprawność intelektualna, lekka'],['F71','Niepełnosprawność intelektualna, umiarkowana'],['F72','Niepełnosprawność intelektualna, znaczna'],['F73','Niepełnosprawność intelektualna, głęboka'],
['F80.2','Zaburzenie językowe'],['F80.0','Zaburzenie dźwięków mowy'],['F80.81','Zaburzenie płynności mowy o początku w dzieciństwie (jąkanie)'],['F80.82','Zaburzenie komunikacji społecznej (pragmatycznej)'],
['F84.0','Zaburzenie ze spektrum autyzmu'],['F90.0','ADHD – obraz z przewagą zaburzeń uwagi'],['F90.1','ADHD – obraz z przewagą nadruchliwości i impulsywności'],['F90.2','ADHD – obraz mieszany'],
['F81.0','Specyficzne zaburzenie uczenia się – czytanie'],['F81.81','Specyficzne zaburzenie uczenia się – pisanie'],['F81.2','Specyficzne zaburzenie uczenia się – matematyka'],
['F82','Zaburzenie koordynacji rozwojowej'],['F95.2','Zaburzenie Tourette’a'],['F95.1','Przewlekłe zaburzenie tikowe ruchowe lub głosowe'],['F95.0','Przejściowe zaburzenie tikowe'],
['F20.9','Schizofrenia'],['F25.x','Zaburzenie schizoafektywne'],['F22','Zaburzenie urojeniowe'],['F23','Krótkotrwałe zaburzenie psychotyczne'],['F21','Zaburzenie osobowości schizotypowej'],
['F31.x','Zaburzenie dwubiegunowe typu I (kod wg epizodu)'],['F31.81','Zaburzenie dwubiegunowe typu II'],['F34.0','Zaburzenie cyklotymiczne'],
['F34.81','Zaburzenie dezregulacji nastroju z wybuchami złości (DMDD)'],['F32.0','Zaburzenie depresyjne większe, pojedynczy epizod, łagodne'],['F32.1','Zaburzenie depresyjne większe, pojedynczy epizod, umiarkowane'],
['F32.2','Zaburzenie depresyjne większe, pojedynczy epizod, ciężkie'],['F33.0','Zaburzenie depresyjne większe, nawracające, łagodne'],['F33.1','Zaburzenie depresyjne większe, nawracające, umiarkowane'],
['F33.2','Zaburzenie depresyjne większe, nawracające, ciężkie'],['F34.1','Uporczywe zaburzenie depresyjne (dystymia)'],['F32.81','Przedmiesiączkowe zaburzenie dysforyczne'],
['F93.0','Zaburzenie lęku separacyjnego'],['F94.0','Mutyzm wybiórczy'],['F40.2xx','Fobia specyficzna'],['F40.10','Zaburzenie lęku społecznego'],['F41.0','Zaburzenie paniczne'],['F40.00','Agorafobia'],['F41.1','Zaburzenie lękowe uogólnione'],
['F42.2','Zaburzenie obsesyjno-kompulsyjne'],['F45.22','Zaburzenie dysmorficzne ciała'],['F42.3','Zaburzenie zbieractwa'],['F63.3','Trichotillomania'],['F42.4','Zaburzenie z drapaniem skóry (dermatillomania)'],
['F94.1','Reaktywne zaburzenie przywiązania'],['F94.2','Zaburzenie rozhamowanego zaangażowania społecznego'],['F43.10','Zaburzenie stresowe pourazowe (PTSD)'],['F43.0','Ostre zaburzenie stresowe'],
['F43.21','Zaburzenie adaptacyjne z obniżonym nastrojem'],['F43.22','Zaburzenie adaptacyjne z lękiem'],['F43.23','Zaburzenie adaptacyjne z lękiem i obniżonym nastrojem'],['F43.24','Zaburzenie adaptacyjne z zaburzeniami zachowania'],
['F43.20','Zaburzenie adaptacyjne, nieokreślone'],['F43.81','Zaburzenie przedłużonej żałoby'],
['F44.81','Dysocjacyjne zaburzenie tożsamości'],['F44.0','Amnezja dysocjacyjna'],['F48.1','Zaburzenie depersonalizacji/derealizacji'],
['F45.1','Zaburzenie z objawami somatycznymi'],['F45.21','Zaburzenie lęku o zdrowie (lęk przed chorobą)'],['F44.x','Zaburzenie konwersyjne (funkcjonalne zaburzenie objawów neurologicznych)'],
['F50.01','Jadłowstręt psychiczny – typ ograniczający (podkod nasilenia wg aktualnej ICD-10-CM)'],['F50.02','Jadłowstręt psychiczny – typ z napadami objadania / przeczyszczaniem'],['F50.2','Bulimia psychiczna'],
['F50.81','Zaburzenie z napadami objadania się'],['F50.82','Zaburzenie z unikaniem/ograniczaniem przyjmowania pokarmów (ARFID)'],['F98.0','Moczenie mimowolne'],['F98.1','Zanieczyszczanie się kałem'],
['F51.01','Zaburzenie z bezsennością'],['F91.3','Zaburzenie opozycyjno-buntownicze'],['F63.81','Przerywane zaburzenie wybuchowe'],['F91.1','Zaburzenie zachowania – początek w dzieciństwie'],
['F91.2','Zaburzenie zachowania – początek w adolescencji'],['F91.9','Zaburzenie zachowania, nieokreślone'],
['F10.10','Zaburzenie związane z używaniem alkoholu, łagodne'],['F10.20','Zaburzenie związane z używaniem alkoholu, umiarkowane lub ciężkie'],['F12.x','Zaburzenie związane z używaniem konopi'],['F63.0','Zaburzenie hazardowe'],
['G31.84','Łagodne zaburzenie neuropoznawcze'],
['F60.0','Osobowość paranoiczna'],['F60.1','Osobowość schizoidalna'],['F60.2','Osobowość antyspołeczna'],['F60.3','Osobowość borderline'],['F60.4','Osobowość histrioniczna'],
['F60.81','Osobowość narcystyczna'],['F60.6','Osobowość unikająca'],['F60.7','Osobowość zależna'],['F60.5','Osobowość obsesyjno-kompulsyjna'],
['Z63.0','Problem w relacji z małżonkiem lub partnerem'],['Z62.820','Problem w relacji rodzic–dziecko'],['Z63.4','Niepowikłana żałoba'],['Z60.0','Problem związany z fazą życia'],
['Z60.4','Wykluczenie lub odrzucenie społeczne'],['Z56.9','Problem związany z zatrudnieniem'],['Z63.5','Rozpad rodziny przez separację lub rozwód']
];
/* ICD-10 (hipoteza planera) → DSM-5-TR */
const TO_DSM = { 'F32.0': 'F32.0', 'F32.1': 'F32.1', 'F32.2': 'F32.2', 'F32': 'F32.x', 'F33.0': 'F33.0', 'F33.1': 'F33.1', 'F33.2': 'F33.2', 'F34.1': 'F34.1', 'F41.1': 'F41.1', 'F41.0': 'F41.0',
  'F40.0': 'F40.00', 'F40.1': 'F40.10', 'F40.2': 'F40.2xx', 'F43.1': 'F43.10', 'F43.2': 'F43.2x', 'F42': 'F42.2', 'F51.0': 'F51.01', 'F10.1': 'F10.10', 'F10.2': 'F10.20', 'F63.0': 'F63.0',
  'F50.0': 'F50.01', 'F50.2': 'F50.2', 'F50': 'F50.x', 'F90.0': 'F90.x', 'F45': 'F45.1', 'Z63.0': 'Z63.0', 'Z62': 'Z62.820', 'Z63.4': 'Z63.4', 'Z60.4': 'Z60.4', 'F91.3': 'F91.3', 'F91': 'F91.9',
  'F93.0': 'F93.0', 'F94.0': 'F94.0', 'F84': 'F84.0', 'F80': 'F80.2', 'F81': 'F81.x', 'F95': 'F95.x', 'F98.0': 'F98.0', 'F41.2': '', 'F93.8': 'F41.1' };
const dsmOf = h => h[2] !== undefined ? h[2] : (TO_DSM[h[0]] ?? '');
const nameDsm = c => (DSM5.find(x => x[0] === c) || [, c.includes('x') ? 'kod do doprecyzowania wg specyfikatorów' : ''])[1];
const name10 = c => (ICD10.find(x => x[0] === c) || [, ''])[1];
const name11 = c => (ICD11.find(x => x[0] === c) || [, ''])[1];

/* ---------- wspólne listy ---------- */
const CRISIS = [
  ['112', 'numer alarmowy – zagrożenie życia lub zdrowia'],
  ['800 70 2222', 'Centrum Wsparcia dla Osób Dorosłych w Kryzysie Psychicznym – bezpłatnie, całą dobę'],
  ['116 123', 'Telefon wsparcia emocjonalnego dla dorosłych'],
  ['116 111', 'Telefon Zaufania dla Dzieci i Młodzieży – całą dobę'],
  ['800 120 002', 'Niebieska Linia – dla osób doznających przemocy domowej']
];
const BASE_TASKS_ADULT = [
  'Zapisuj krótko, co działo się między spotkaniami i co chcesz omówić',
  'Stała pora wstawania każdego dnia, także w weekend',
  'Codziennie co najmniej 20 minut ruchu, najlepiej na zewnątrz',
  'Przyjdź na kolejne spotkanie – termin: ____________________'
];
const BASE_TASKS_CHILD = [
  'Stały plan dnia dziecka ze stałą porą snu i posiłków',
  'Codziennie 10–15 minut czasu tylko z dzieckiem, bez telefonu – dziecko wybiera zabawę',
  'Zapisuj sytuacje trudne: co było przed, co się stało, co było potem',
  'Przynieś opinie ze szkoły / poradni i zeszyty dziecka',
  'Kolejne spotkanie – termin: ____________________'
];

/* ---------- reguły ----------
   każda reguła: when(a,s) → true/false; zwraca hipotezy, uzasadnienie, kierunki, cele, zadania dla pacjenta
*/
const any = (a, ...k) => k.some(x => a[x]);
const cnt = (a, ...k) => k.filter(x => a[x]).length;
const durAtLeast = (v, idx) => DUR.indexOf(v) >= idx;

const RULES_ADULT = [
  { id: 'dep', when: (a, s) => (s.phq >= 10) || (any(a, 'm_low', 'm_anh') && cnt(a, 'm_low', 'm_anh', 'm_energy', 'm_guilt', 'm_conc', 'm_appetite', 'm_hopeless') >= 4 && durAtLeast(a.m_dur, 1)),
    build: (a, s) => {
      const sev = s.phq >= 20 ? 2 : s.phq >= 10 ? 1 : 0; // PHQ-9: <10 łagodny, 10–19 umiarkowany, ≥20 ciężki – nasilenie potwierdź klinicznie
      const h = a.m_prior ? [['F33.' + sev, '6A71']] : [['F32.' + sev, '6A70']];
      if (a.m_years2) h.push(['F34.1', '6A72']);
      return { area: 'Nastrój', hyp: h,
        why: `Objawy depresyjne${s.phqDone ? ` (PHQ-9 = ${s.phq}, ${band(PHQ9, s.phq)})` : ''}${a.m_dur ? ', czas: ' + a.m_dur : ''}${a.m_prior ? ', wcześniejsze epizody' : ''}.`,
        dir: ['Psychoedukacja o depresji i planie pomocy', 'Aktywacja behawioralna', 'Terapia poznawczo-behawioralna (CBT)', 'Monitorowanie nastroju i PHQ-9 co 2–4 tygodnie',
          ...(s.phq >= 15 || s.risk >= 2 ? ['Konsultacja psychiatryczna (nasilenie / ryzyko)'] : [])],
        goals: ['Zwiększenie liczby aktywności dających przyjemność i poczucie sensu', 'Zmniejszenie nasilenia objawów nastroju (PHQ-9 poniżej 10)'],
        tasks: ['Codziennie zaplanuj jedną małą przyjemną lub ważną czynność i odhacz ją po wykonaniu', 'Wieczorem oceń nastrój w skali 0–10 i zapisz jedno zdanie o dniu'] };
    } },
  { id: 'gad', when: (a, s) => s.gad >= 10 || (a.a_worry && a.a_tension && durAtLeast(a.a_dur, 3)),
    build: (a, s) => ({ area: 'Lęk uogólniony', hyp: [['F41.1', '6B00']],
      why: `Zamartwianie i napięcie${s.gadDone ? ` (GAD-7 = ${s.gad}, ${band(GAD7, s.gad)})` : ''}${a.a_dur ? ', czas: ' + a.a_dur : ''}.`,
      dir: ['CBT ukierunkowana na zamartwianie i nietolerancję niepewności', 'Relaksacja stosowana', 'Psychoedukacja o mechanizmie lęku'],
      goals: ['Zmniejszenie czasu poświęcanego na zamartwianie', 'Lepsza tolerancja niepewności'],
      tasks: ['Wyznacz codziennie 15 minut „czasu na martwienie się” i odkładaj na ten czas pojawiające się zmartwienia', 'Ćwicz spokojny oddech: wdech 4 sekundy, wydech 6 sekund, przez 5 minut dziennie', 'Ogranicz kawę i napoje energetyczne'] }) },
  { id: 'panic', when: a => a.a_panic && a.a_panic_fear,
    build: a => ({ area: 'Napady lęku', hyp: a.a_agora ? [['F41.0', '6B01'], ['F40.0', '6B02']] : [['F41.0', '6B01']],
      why: 'Nawracające napady silnego lęku z obawą przed kolejnymi' + (a.a_agora ? ' i unikaniem miejsc.' : '.'),
      dir: ['Psychoedukacja o błędnym kole lęku', 'CBT z ekspozycją na doznania z ciała', ...(a.a_agora ? ['Stopniowa ekspozycja na unikane sytuacje'] : []), 'Wykluczenie przyczyn somatycznych u lekarza'],
      goals: ['Zmniejszenie częstości napadów lęku', 'Powrót do unikanych miejsc i aktywności'],
      tasks: ['Zapisuj napady silnego lęku: kiedy, co czułaś/czułeś, co pomogło', 'Przypominaj sobie: to uczucie jest bardzo nieprzyjemne, ale mija i nie jest groźne', 'Umów kontrolną wizytę u lekarza rodzinnego'] }) },
  { id: 'social', when: a => a.a_social,
    build: () => ({ area: 'Lęk społeczny', hyp: [['F40.1', '6B04']], why: 'Silny lęk i unikanie w sytuacjach społecznych.',
      dir: ['CBT dla lęku społecznego (model Clarka i Wellsa)', 'Ekspozycja z hierarchią sytuacji', 'Praca z uwagą skierowaną na siebie'],
      goals: ['Stopniowe wchodzenie w unikane sytuacje społeczne'], tasks: ['Wypisz 10 sytuacji społecznych od najłatwiejszej do najtrudniejszej'] }) },
  { id: 'specific', when: a => a.a_specific,
    build: () => ({ area: 'Lęk specyficzny', hyp: [['F40.2', '6B03']], why: 'Silny lęk przed konkretnym obiektem lub sytuacją.',
      dir: ['Terapia ekspozycyjna (stopniowa)'], goals: ['Zmniejszenie unikania obiektu lęku'], tasks: [] }) },
  { id: 'ptsd', when: a => a.t_event && a.t_intrusion && a.t_avoid && a.t_hyper,
    build: a => ({ area: 'Trauma', hyp: a.t_self ? [['F43.1', '6B41']] : [['F43.1', '6B40']],
      why: 'Zdarzenie traumatyczne z ponownym przeżywaniem, unikaniem i nadmierną czujnością' + (a.t_self ? ' oraz trwałymi trudnościami w regulacji emocji, obrazie siebie i relacjach (różnicuj CPTSD).' : '.'),
      dir: ['Stabilizacja i psychoedukacja', 'Terapia skoncentrowana na traumie: TF-CBT, CPT lub EMDR', ...(a.t_self ? ['Etapowe podejście: regulacja emocji przed pracą z traumą'] : [])],
      goals: ['Zmniejszenie natrętnych wspomnień i unikania', 'Poczucie bezpieczeństwa w codziennym życiu'],
      tasks: ['Ćwiczenie uziemienia 5-4-3-2-1: nazwij 5 rzeczy, które widzisz, 4 które słyszysz, 3 których dotykasz, 2 zapachy, 1 smak', 'Utrzymuj stałą rutynę dnia'] }) },
  { id: 'adjust', when: (a, s, done) => a.t_recent && a.t_adjust && !done.ptsd,
    build: () => ({ area: 'Reakcja na stresor', hyp: [['F43.2', '6B43']], why: 'Zaabsorbowanie niedawnym stresorem i trudności w przystosowaniu.',
      dir: ['Interwencja kryzysowa i wsparcie', 'Trening rozwiązywania problemów', 'Wzmacnianie zasobów i sieci wsparcia'],
      goals: ['Odzyskanie równowagi i planu działania po trudnym wydarzeniu'], tasks: ['Wypisz jedną sprawę związaną z sytuacją, którą możesz załatwić w tym tygodniu'] }) },
  { id: 'grief', when: a => a.t_grief,
    build: () => ({ area: 'Żałoba', hyp: [['F43.2', '6B42', 'F43.81'], ['Z63.4', '', 'Z63.4']], why: 'Żałoba trwająca ponad 6 miesięcy z silną tęsknotą i cierpieniem.',
      dir: ['Terapia przedłużonej żałoby (np. CBT dla żałoby)', 'Rytuały i praca z pamięcią o zmarłym'], goals: ['Stopniowy powrót do ważnych aktywności z zachowaniem więzi ze zmarłym'], tasks: [] }) },
  { id: 'ocd', when: a => any(a, 'o_obs', 'o_comp'),
    build: () => ({ area: 'Natręctwa', hyp: [['F42', '6B20']], why: 'Natrętne myśli lub czynności przymusowe.',
      dir: ['CBT z ekspozycją i powstrzymywaniem reakcji (ERP)', 'Pomiar nasilenia (np. Y-BOCS)', 'Rozważ konsultację psychiatryczną przy dużym nasileniu'],
      goals: ['Ograniczenie czasu poświęcanego na rytuały'], tasks: ['Zapisuj przez tydzień, ile czasu dziennie zajmują natrętne myśli i czynności'] }) },
  { id: 'sleep', when: a => a.s_insomnia,
    build: a => ({ area: 'Sen', hyp: a.s_3m ? [['F51.0', '7A00']] : [['F51.0', '7A01']], why: 'Trudności ze snem co najmniej 3 noce w tygodniu' + (a.s_3m ? ' od ponad 3 miesięcy.' : '.'),
      dir: ['CBT-I (terapia poznawczo-behawioralna bezsenności) – leczenie pierwszego wyboru', 'Dzienniczek snu przez 2 tygodnie'],
      goals: ['Poprawa jakości i ciągłości snu'],
      tasks: ['Łóżko tylko do snu – jeśli nie możesz zasnąć przez ok. 20 minut, wstań i wróć, gdy poczujesz senność', 'Bez ekranów na godzinę przed snem', 'Prowadź dzienniczek snu przez 2 tygodnie'] }) },
  { id: 'burnout', when: a => a.b_exhaust && any(a, 'b_cynic', 'b_eff'),
    build: () => ({ area: 'Praca', hyp: [['Z73.0', 'QD85']], why: 'Wyczerpanie związane z pracą z dystansem lub spadkiem skuteczności (wypalenie to zjawisko zawodowe, nie choroba).',
      dir: ['Analiza obciążeń i zasobów w pracy', 'Trening radzenia sobie ze stresem, stawianie granic', 'Planowanie regeneracji', 'Wykluczenie depresji'],
      goals: ['Odzyskanie energii i równowagi praca–odpoczynek'], tasks: ['Codziennie zaplanuj przerwę bez telefonu', 'Wypisz zadania w pracy: co mogę oddać, uprościć, odłożyć'] }) },
  { id: 'alcohol', when: a => any(a, 'u_alcohol', 'u_control'),
    build: a => ({ area: 'Alkohol', hyp: [[a.u_control ? 'F10.2' : 'F10.1', '6C40']], why: a.u_control ? 'Utrata kontroli nad piciem / głód alkoholowy.' : 'Ryzykowne picie alkoholu.',
      dir: ['Pomiar AUDIT', 'Dialog motywujący', ...(a.u_control ? ['Skierowanie do terapii uzależnień'] : ['Krótka interwencja'])],
      goals: ['Ograniczenie lub zaprzestanie picia'], tasks: ['Przez tydzień zapisuj, kiedy i ile alkoholu pijesz'] }) },
  { id: 'drugs', when: a => a.u_drugs,
    build: () => ({ area: 'Substancje', hyp: [['F19', '']], why: 'Używanie substancji psychoaktywnych – doprecyzuj rodzaj (kody F11–F19 / 6C41–6C4H).',
      dir: ['Ocena wzorca używania', 'Dialog motywujący', 'Rozważ skierowanie do poradni uzależnień'], goals: [], tasks: [] }) },
  { id: 'gambling', when: a => a.u_gambling,
    build: () => ({ area: 'Hazard', hyp: [['F63.0', '6C50']], why: 'Problemowy hazard.', dir: ['CBT, dialog motywujący', 'Kontrola finansów'], goals: [], tasks: [] }) },
  { id: 'gaming', when: a => a.u_gaming,
    build: () => ({ area: 'Granie / internet', hyp: [['F63.8', '6C51']], why: 'Nadmierne granie lub korzystanie z internetu.', dir: ['CBT, plan ograniczania'], goals: [], tasks: ['Zapisuj przez tydzień czas spędzony na graniu / w internecie'] }) },
  { id: 'eating', when: a => any(a, 'e_restrict', 'e_binge', 'e_comp'),
    build: a => ({ area: 'Odżywianie', hyp: [[a.e_restrict ? 'F50.0' : a.e_comp ? 'F50.2' : 'F50', a.e_restrict ? '6B80' : a.e_comp ? '6B81' : '6B82']],
      why: 'Niepokojące zachowania związane z jedzeniem – wymaga pogłębionej oceny.',
      dir: ['Pilna ocena stanu somatycznego u lekarza', 'CBT-E / specjalistyczna terapia zaburzeń odżywiania', 'Rozważ skierowanie do ośrodka specjalistycznego'],
      goals: [], tasks: ['Umów wizytę u lekarza rodzinnego w ciągu tygodnia'] }) },
  { id: 'adhd', when: a => a.d_child && any(a, 'd_impuls'),
    build: () => ({ area: 'Uwaga', hyp: [['F90.0', '6A05']], why: 'Trudności z uwagą i impulsywność od dzieciństwa.',
      dir: ['Diagnoza ADHD dorosłych (wywiad rozwojowy, DIVA-5), konsultacja psychiatryczna', 'Psychoedukacja, CBT dla ADHD, strategie organizacyjne'],
      goals: ['Lepsza organizacja dnia i zadań'], tasks: ['Używaj jednego kalendarza na wszystko', 'Każdego ranka wypisz 3 najważniejsze zadania dnia'] }) },
  { id: 'somatic', when: a => a.so_somatic,
    build: () => ({ area: 'Ciało', hyp: [['F45', '6C20']], why: 'Absorbujące dolegliwości somatyczne bez wyjaśnienia medycznego.',
      dir: ['Współpraca z lekarzem prowadzącym', 'CBT, praca z uwagą i interpretacją doznań'], goals: [], tasks: [] }) },
  { id: 'relation', when: a => a.r_conflict,
    build: () => ({ area: 'Związek', hyp: [['Z63.0', '']], why: 'Kryzys w związku.', dir: ['Rozważ konsultację lub terapię par', 'Trening komunikacji'], goals: ['Poprawa komunikacji w związku'], tasks: [] }) },
  { id: 'parenting', when: a => a.r_parenting,
    build: () => ({ area: 'Rodzicielstwo', hyp: [['Z62', '']], why: 'Trudności wychowawcze.', dir: ['Trening umiejętności rodzicielskich'], goals: [], tasks: [] }) }
];

const RULES_CHILD = [
  { id: 'adhd', when: a => (a.c_inatt || (a.c_hyper && a.c_impuls)),
    build: a => ({ area: 'Uwaga i aktywność', hyp: [['F90.0', '6A05']], why: 'Nieuwaga' + (a.c_hyper ? ', nadruchliwość' : '') + (a.c_impuls ? ', impulsywność' : '') + (a.c_two ? ' w domu i w szkole.' : '. Sprawdź, czy trudności występują w co najmniej dwóch środowiskach.'),
      dir: ['Kwestionariusze dla rodzica i nauczyciela (np. Conners)', 'Trening umiejętności rodzicielskich', 'Współpraca ze szkołą', 'Skierowanie do psychiatry dziecięcego / PPP w celu diagnozy'],
      goals: ['Poprawa funkcjonowania w domu i w szkole'],
      tasks: ['Polecenia krótkie i jedno na raz, po nawiązaniu kontaktu wzrokowego', 'Chwal konkretne zachowanie od razu, gdy się pojawi', 'Odrabianie lekcji w krótkich odcinkach z przerwami'] }) },
  { id: 'odd', when: a => any(a, 'c_defiant', 'c_anger', 'c_aggr'),
    build: a => ({ area: 'Zachowanie', hyp: a.c_aggr ? [['F91', '6C91']] : [['F91.3', '6C90']], why: a.c_aggr ? 'Agresja i poważne łamanie zasad.' : 'Sprzeciw, kłótliwość, napady złości.',
      dir: ['Trening zarządzania zachowaniem dla rodziców (PMT)', 'Spójne zasady w domu i w szkole'], goals: ['Mniej konfliktów i napadów złości'],
      tasks: ['Ustalcie z dzieckiem 3 najważniejsze zasady domu i zapiszcie je', 'Reaguj spokojnie i krótko na niewłaściwe zachowanie, nagradzaj właściwe'] }) },
  { id: 'sep', when: a => a.c_sep, build: () => ({ area: 'Lęk separacyjny', hyp: [['F93.0', '6B05']], why: 'Silny lęk przy rozstaniu z rodzicem.',
      dir: ['CBT z udziałem rodzica', 'Stopniowe ćwiczenie rozstań'], goals: ['Spokojniejsze rozstania'], tasks: ['Krótkie, przewidywalne pożegnanie – zawsze tak samo'] }) },
  { id: 'anx', when: a => any(a, 'c_worry', 'c_fears', 'c_social'),
    build: a => ({ area: 'Lęki', hyp: [[a.c_social ? 'F40.1' : a.c_fears ? 'F40.2' : 'F93.8', a.c_social ? '6B04' : a.c_fears ? '6B03' : '6B00']], why: 'Lęki / zamartwianie u dziecka.',
      dir: ['CBT dla dzieci z udziałem rodzica', 'Stopniowa ekspozycja, nauka rozpoznawania emocji'], goals: ['Mniej unikania sytuacji lękowych'],
      tasks: ['Nie wyręczaj dziecka w sytuacjach lękowych – zachęcaj do małych kroków i chwal za próby'] }) },
  { id: 'mutism', when: a => a.c_mutism, build: () => ({ area: 'Mowa w sytuacjach społecznych', hyp: [['F94.0', '6B06']], why: 'Brak mowy w niektórych sytuacjach.', dir: ['Terapia behawioralna, współpraca ze szkołą'], goals: [], tasks: [] }) },
  { id: 'mood', when: a => any(a, 'c_mood', 'c_anh'), build: (a, s) => ({ area: 'Nastrój', hyp: [['F32', '6A70']], why: 'Smutek lub drażliwość większość dni' + (s.phqDone ? ` (PHQ-9 = ${s.phq})` : '') + '.',
      dir: ['CBT dla młodzieży, praca z rodziną', 'Ocena ryzyka', 'Rozważ konsultację psychiatry dziecięcego'], goals: ['Poprawa nastroju i aktywności'], tasks: ['Zaplanujcie razem jedną przyjemną aktywność dziennie'] }) },
  { id: 'asd', when: a => a.c_soc && a.c_rigid, build: () => ({ area: 'Rozwój społeczny', hyp: [['F84', '6A02']], why: 'Trudności w komunikacji społecznej oraz sztywne zachowania.',
      dir: ['Skierowanie na diagnozę spektrum autyzmu (zespół diagnostyczny, ADOS-2 / ADI-R)', 'Wsparcie rodziców, dostosowania w szkole'], goals: [], tasks: ['Zapisuj sytuacje, które dziecko znosi szczególnie trudno (hałas, zmiany planu)'] }) },
  { id: 'speech', when: a => a.c_speech, build: () => ({ area: 'Mowa', hyp: [['F80', '6A01']], why: 'Trudności rozwoju mowy.', dir: ['Konsultacja logopedyczna'], goals: [], tasks: ['Umów konsultację logopedyczną'] }) },
  { id: 'learn', when: a => a.c_learning, build: () => ({ area: 'Nauka', hyp: [['F81', '6A03']], why: 'Trudności w czytaniu, pisaniu lub liczeniu.', dir: ['Diagnoza w poradni psychologiczno-pedagogicznej'], goals: [], tasks: [] }) },
  { id: 'tics', when: a => a.c_tics, build: () => ({ area: 'Tiki', hyp: [['F95', '8A05']], why: 'Tiki.', dir: ['Psychoedukacja, CBIT', 'Konsultacja neurologiczna'], goals: [], tasks: ['Nie zwracaj dziecku uwagi na tiki'] }) },
  { id: 'enur', when: a => a.c_enuresis, build: () => ({ area: 'Moczenie', hyp: [['F98.0', '6C00']], why: 'Moczenie po 5. roku życia.', dir: ['Najpierw konsultacja pediatryczna', 'Terapia behawioralna (alarm, kalendarz suchych nocy)'], goals: [], tasks: ['Umów konsultację u pediatry', 'Kalendarz suchych nocy – bez kar'] }) },
  { id: 'trauma', when: a => a.c_trauma, build: () => ({ area: 'Trudne wydarzenie', hyp: [['F43.2', '6B43']], why: 'Trudne wydarzenie w życiu dziecka – oceń objawy stresu pourazowego.', dir: ['TF-CBT z udziałem opiekuna'], goals: [], tasks: [] }) },
  { id: 'bully', when: a => a.c_bully, build: () => ({ area: 'Rówieśnicy', hyp: [['Z60.4', '']], why: 'Przemoc rówieśnicza / odrzucenie.', dir: ['Współpraca ze szkołą', 'Trening umiejętności społecznych'], goals: [], tasks: ['Porozmawiaj z wychowawcą o sytuacji dziecka'] }) },
  { id: 'gaming', when: a => a.c_gaming, build: () => ({ area: 'Ekrany', hyp: [['F63.8', '6C51']], why: 'Problem z grami / telefonem.', dir: ['Plan korzystania z ekranów razem z dzieckiem'], goals: [], tasks: ['Ustalcie razem stałe godziny korzystania z ekranów'] }) },
  { id: 'eat', when: a => a.c_eating, build: () => ({ area: 'Jedzenie', hyp: [['F50', '']], why: 'Niepokojące jedzenie lub waga – wymaga oceny.', dir: ['Pilna konsultacja pediatryczna'], goals: [], tasks: ['Umów wizytę u pediatry'] }) }
];

/* ---------- analiza ---------- */
function scores(a) {
  const phqVals = PHQ9.items.map((_, i) => a['phq_' + i]), gadVals = GAD7.items.map((_, i) => a['gad_' + i]);
  const phqDone = phqVals.every(v => v !== undefined && v !== ''), gadDone = gadVals.every(v => v !== undefined && v !== '');
  const sum = arr => arr.reduce((x, v) => x + (Number(v) || 0), 0);
  return { phq: sum(phqVals), gad: sum(gadVals), phqDone, gadDone, phq9: Number(a.phq_8) || 0 };
}
function risk(a, s) {
  const alerts = [];let lvl = 0;
  if (a.k_plan || (a.k_ideation && (a.k_attempt || a.k_means))) { lvl = 3; alerts.push('WYSOKIE RYZYKO: myśli samobójcze z planem / próbą w przeszłości / dostępem do środków. Pilna ocena, plan bezpieczeństwa, rozważ natychmiastową konsultację psychiatryczną lub 112.') }
  else if (a.k_ideation || s.phq9 >= 2 || a.k_selfharm) { lvl = 2; alerts.push('Ryzyko: myśli samobójcze lub samookaleczenia. Pogłębiona ocena ryzyka i wspólny plan bezpieczeństwa na tej wizycie.') }
  else if (a.k_passive || s.phq9 === 1) { lvl = 1; alerts.push('Myśli rezygnacyjne – monitoruj na każdej wizycie.') }
  if (a.k_harm) alerts.push('Podejrzenie krzywdzenia dziecka – zabezpieczenie dziecka, rozważ procedurę „Niebieskie Karty” i zawiadomienie odpowiednich służb.');
  if (a.r_violence) alerts.push('Przemoc wobec pacjenta – plan bezpieczeństwa, informacja o Niebieskiej Linii, rozważ procedurę „Niebieskie Karty”.');
  if (a.x_mania) alerts.push('Okresy podwyższonego nastroju – konsultacja psychiatryczna, różnicowanie zaburzenia dwubiegunowego (F31 / 6A60–6A61) przed pracą nad depresją.');
  if (a.x_psych) alerts.push('Objawy psychotyczne – pilna konsultacja psychiatryczna (F2x / 6A2x).');
  if (a.x_memory) alerts.push('Nowe trudności poznawcze – konsultacja lekarska / neurologiczna (F06.7 / 6D71).');
  return { lvl, alerts };
}
function analyze(intake) {
  const a = intake?.a || {}, tpl = intake?.tpl || 'dorosly';
  const s = scores(a);const r = risk(a, s);s.risk = r.lvl;
  const rules = tpl === 'dziecko' ? RULES_CHILD : RULES_ADULT;
  const done = {}, findings = [];
  for (const rule of rules) { if (rule.when(a, s, done)) { done[rule.id] = true; findings.push(Object.assign({ id: rule.id }, rule.build(a, s))) } }
  if (tpl === 'dorosly' && !done.dep && !done.gad && s.phqDone && s.gadDone && s.phq >= 5 && s.gad >= 5)
    findings.push({ id: 'mixed', area: 'Nastrój i lęk', hyp: [['F41.2', '6A73']], why: `Łagodne objawy depresyjne i lękowe (PHQ-9 = ${s.phq}, GAD-7 = ${s.gad}).`, dir: ['Psychoedukacja, CBT o niskiej intensywności', 'Ponowny pomiar za 4 tygodnie'], goals: ['Zmniejszenie objawów nastroju i lęku'], tasks: [] });
  if (!findings.length) findings.push({ id: 'none', area: 'Bez wyraźnych wskazań', hyp: [['Z03.2', '']], why: 'Zebrane dane nie wskazują jednoznacznie na zaburzenie – kontynuuj diagnozę lub pracę konsultacyjną.', dir: ['Doprecyzowanie problemu i celów'], goals: [], tasks: [] });
  const base = tpl === 'dziecko' ? BASE_TASKS_CHILD : BASE_TASKS_ADULT;
  const tasks = [...new Set([...base.slice(0, -1), ...findings.flatMap(f => f.tasks || []), base[base.length - 1]])];
  return { tpl, s, risk: r, findings, tasks };
}

const ALIAS = { 'F90.0': 'adhd add hiperkinetyczne', '6A05': 'adhd add', 'F41.0': 'panika napady paniki', '6B01': 'panika', 'F43.1': 'ptsd trauma', '6B40': 'ptsd trauma', '6B41': 'cptsd trauma',
  'F42': 'ocd natrectwa', '6B20': 'ocd natrectwa', 'F84': 'autyzm asd spektrum', 'F84.0': 'autyzm asd', 'F84.5': 'asperger asd', '6A02': 'asd autyzm', 'F32': 'depresja', 'F33': 'depresja nawracajaca',
  '6A70': 'depresja', '6A71': 'depresja', 'F41.1': 'gad lek uogolniony', '6B00': 'gad', 'F60.3': 'borderline bpd', '6D11.5': 'borderline bpd', 'Z73.0': 'wypalenie burnout', 'QD85': 'wypalenie burnout',
  'F51.0': 'bezsennosc insomnia', '7A00': 'bezsennosc insomnia', 'F31': 'chad dwubiegunowa', '6A60': 'chad', '6A61': 'chad', 'F91.3': 'odd opozycyjno', '6C90': 'odd' };
return { PHQ9, GAD7, band, TEMPLATES, ICD10, ICD11, DSM5, name10, name11, nameDsm, dsmOf, CRISIS, analyze, DUR, ALIAS };
})();
