import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DisclaimerModal from './DisclaimerModal';

const KEY = 'meridian-disclaimer-accepted';

beforeEach(() => localStorage.clear());

// The overlay is the fixed full-screen layer; the card is the box inside it.
function overlayAndCard() {
  const button = screen.getByRole('button', { name: /i understand/i });
  const overlay = button.closest('[style*="position: fixed"]');
  return { overlay, card: overlay.firstElementChild };
}

describe('DisclaimerModal: show once', () => {
  test('appears on a first visit and is gone for good after accepting', () => {
    render(<DisclaimerModal />);
    fireEvent.click(screen.getByRole('button', { name: /i understand/i }));
    expect(screen.queryByRole('button', { name: /i understand/i })).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('true');
  });

  test('stays hidden for someone who already accepted', () => {
    localStorage.setItem(KEY, 'true');
    render(<DisclaimerModal />);
    expect(screen.queryByText(/important disclaimer/i)).toBeNull();
  });
});

// On a 375x667 phone the card is about 900px tall. Before the fix the overlay could not scroll and centred the card, so
// the top was cut off above the screen and the "I Understand" button below it, and nobody could get past the notice.
describe('DisclaimerModal: small screens', () => {
  test('the overlay scrolls when the card is taller than the screen', () => {
    render(<DisclaimerModal />);
    const { overlay } = overlayAndCard();
    expect(overlay.style.overflowY).toBe('auto');
  });

  test('the card is centred with auto margins, not align-items: center, so its top edge can always be reached', () => {
    render(<DisclaimerModal />);
    const { overlay, card } = overlayAndCard();
    expect(overlay.style.alignItems).not.toBe('center');
    expect(card.style.margin).toBe('auto');
  });
});
