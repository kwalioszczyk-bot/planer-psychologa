/* =====================================================================
   PLANER GABINETU – USTAWIENIA DLA KONKRETNEGO PSYCHOLOGA
   Zmieniasz tylko ten plik. Wartości są domyślne – psycholog może je
   później poprawić w aplikacji (Ustawienia). Żadnych danych pacjentów!
   ===================================================================== */
window.PLANER_CONFIG = {
  psycholog: 'Imię Nazwisko',                 // na wydrukach i w dokumentacji
  nrWpisu: '',                                // nr wpisu do Rejestru Psychologów
  gabinet: 'Gabinet Psychologiczny',          // nazwa gabinetu (nagłówek wydruków)
  adres: 'ul. Przykładowa 1, 00-000 Miasto',  // adres gabinetu
  kontakt: '',                                // telefon / e-mail na wydrukach dla pacjenta
  miejsca: ['Gabinet', 'Online'],             // miejsca spotkań (pierwsze = domyślne)
  cenaSesji: 200,                             // zł – sesja indywidualna
  cenaPary: 250,                              // zł – sesja pary
  czasSesji: 50,                              // minuty
  prefiksKodu: 'P',                           // kody pacjentów: P-001, P-002…
  motyw: 'szalwia',                           // 'szalwia' | 'roz' | 'granat'
  kolory: null,                               // własne kolory, np. { primary:'#5F7559', deep:'#3F5239', soft2:'#DDE6D6', soft3:'#F2DDCF' }
  stopka: '',                                 // np. 'Szablon planera: Centrum NewWay'
  google: false,                              // true = karta Kalendarza Google w Ustawieniach (wymaga OAuth Client ID)
  demo: false                                 // true = wersja poglądowa z przykładowymi danymi (adres z #demo działa tak samo)
};
