import FlashcardItem from "./FlashcardItem";
import type { FlashcardEntry } from "../lib/flashcard-store";

interface FlashcardListProps {
  cards: FlashcardEntry[];
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    partial: Partial<Omit<FlashcardEntry, "id" | "createdAt">>,
  ) => void;
}

function FlashcardList({ cards, onDelete, onUpdate }: FlashcardListProps) {
  return (
    <div className="sp-card-list">
      {cards.map((card) => (
        <FlashcardItem
          key={card.id}
          card={card}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

export default FlashcardList;
