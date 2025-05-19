import React, { Dispatch, FC, SetStateAction } from "react";
import {
  IconBolt,
  IconChevronDown,
} from "@tabler/icons-react";
import { Popover, Button, ScrollArea } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Editor } from "@tiptap/react";

interface ContextMenuProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onSelect: (action: string) => void;
  editor: Editor;
}

const contextActions = [
  { name: "Block ID", icon: IconBolt },
  { name: "Show Attributes", icon: IconBolt }, // added button for showing all attributes
];

export const ContextMenu: FC<ContextMenuProps> = ({
  isOpen,
  setIsOpen,
  onSelect,
  editor,
}) => {
  const { t } = useTranslation();

  const handleSelect = (action: string) => {
    onSelect(action);
    setIsOpen(false);

    const { state } = editor;
    const { selection } = state;
    const fromPos = selection.from;

    let foundNode = null;

    state.doc.nodesBetween(fromPos, fromPos, (node, pos, parent) => {
      if (node.attrs?.id) {
        foundNode = node;
        return false;
      }
      return true;
    });

    if (action === "Block ID") {
      if (foundNode?.attrs?.id) {
        console.log("Block ID:", foundNode.attrs.id);
      } else {
        console.log("ID not found for selected block");
      }
    }

    if (action === "Show Attributes") {
      if (foundNode) {
        console.log("Attributes of selected block:", foundNode.attrs);
      } else {
        console.log("No node found for selected block");
      }
    }
  };


  return (
    <Popover opened={isOpen} withArrow position="bottom">
      <Popover.Target>
        <Button
          variant="default"
          style={{ border: "none", height: "34px" }}
          radius="0"
          rightSection={<IconChevronDown size={16} />}
          onClick={() => setIsOpen(!isOpen)}
        >
          {t("Actions")}
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <ScrollArea.Autosize type="scroll" mah={400}>
          <Button.Group orientation="vertical">
            {contextActions.map((item, index) => (
              <Button
                key={index}
                variant="default"
                leftSection={<item.icon size={16} />}
                justify="left"
                fullWidth
                onClick={() => handleSelect(item.name)}
                style={{ border: "none" }}
              >
                {t(item.name)}
              </Button>
            ))}
          </Button.Group>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
};
