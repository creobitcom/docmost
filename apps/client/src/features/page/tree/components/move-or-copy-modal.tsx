import { Modal, Button, Group, Text } from "@mantine/core";

interface MoveOrCopyModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (action: "move" | "copy") => void;
  dragNodeLabel: string;
}

export function MoveOrCopyModal({
  opened,
  onClose,
  onConfirm,
  dragNodeLabel,
}: MoveOrCopyModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Move or Copy" centered>
      <Text>
        Do you want to move or copy <b>{dragNodeLabel}</b> to the new location?
      </Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => onConfirm("copy")}>Copy</Button>
        <Button color="blue" onClick={() => onConfirm("move")}>
          Move
        </Button>
      </Group>
    </Modal>
  );
}
