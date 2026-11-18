const cases = [
  ['Empty Message?', { text: '' }, 0], ['Empty Message?', { text: '  ' }, 0], ['Empty Message?', { text: 'hi' }, 1],
  ['Route Consent', { intent: 'book' }, 2], ['Route Consent', { _booking_reply: 'consent_unclear' }, 0], ['Route Consent', { _booking_reply: 'consent_handoff' }, 1], ['Route Consent', { _booking_reply: null }, 2],
  ['Booking Declined?', { intent: 'book' }, 1], ['Booking Declined?', { _booking_reply: 'declined' }, 0], ['Booking Declined?', { _booking_reply: 'consent_unclear' }, 1],
  ['Abort Cancel?', { state: { stage: 'cancel_confirming' }, intent: 'confirm', _consent_yes: true }, 1],
  ['Abort Cancel?', { state: { stage: 'cancel_confirming' }, intent: 'confirm' }, 0],
  ['Abort Cancel?', { state: { stage: 'cancel_confirming' }, intent: 'cancel', _consent_yes: true }, 0],
  ['Abort Cancel?', { state: { stage: 'booked' }, intent: 'book' }, 1],
  ['Abort Reschedule?', { state: { stage: 'reschedule_confirming' }, intent: 'confirm', _consent_yes: true }, 1],
  ['Abort Reschedule?', { state: { stage: 'reschedule_confirming' }, intent: 'confirm', _consent_yes: false }, 0],
  ['Booking Fresh?', { state: { stage: 'confirming', turn_count: 3, confirm_turn: '3', slots: { date: '2099-01-01', time: '10:00' } } }, 0],
  ['Booking Fresh?', { state: { stage: 'confirming', turn_count: 3, confirm_turn: '3', slots: { date: '2020-01-01', time: '10:00' } } }, 1],
  ['Booking Fresh?', { state: { stage: 'confirming', turn_count: 3, confirm_turn: '2', slots: { date: '2099-01-01', time: '10:00' } } }, 1],
  ['Booking Fresh?', { state: { stage: 'booked', turn_count: 3, confirm_turn: '', slots: {} } }, 0],
  ['Reschedule Fresh?', { state: { stage: 'reschedule_confirming', turn_count: 4, confirm_turn: '4', slots: { date: '2099-01-01', time: '12:00' } } }, 0],
  ['Reschedule Fresh?', { state: { stage: 'reschedule_confirming', turn_count: 4, confirm_turn: '4', slots: { date: '2020-01-01', time: '12:00' } } }, 1],
  ['Reschedule Fresh?', { state: { stage: 'reschedule_confirming', turn_count: 4, confirm_turn: '4', slots: { date: '2099-01-01', time: null } } }, 1],
];
(async () => {
  let bad = 0;
  for (const [node, item, want] of cases) {
    const r = await fetch('http://127.0.0.1:5678/webhook/hd-shapes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ node, item }) });
    const t = await r.text(); let got; try { got = JSON.parse(t).out; } catch { got = 'HTTP ' + r.status + ' ' + t.slice(0, 80); }
    const ok = got === want; bad += ok ? 0 : 1;
    console.log(`${ok ? '✓' : '✗'} ${node} ${JSON.stringify(item)} → ${got} (want ${want})`);
  }
  console.log(bad ? `shapes: ${bad} FAILED` : 'shapes: OK');
})();
