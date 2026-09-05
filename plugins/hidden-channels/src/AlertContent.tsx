import {
    stylesheet,
    constants,
    moment,
    clipboard,
    React,
} from "@vendetta/metro/common";

import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import {
    getAssetIDByName,
} from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

const snowflakeUtils = findByProps(
    "extractTimestamp"
);

const MessageStyles =
    stylesheet.createThemedStyleSheet({
        text: {
            fontSize: 16,
            color:
                semanticColors.HEADER_PRIMARY,
        },

        bold: {
            fontFamily:
                constants.Fonts.PRIMARY_SEMIBOLD,
        },

        highlight: {
            backgroundColor:
                semanticColors.BACKGROUND_MESSAGE_HIGHLIGHT_HOVER,
        },
    });

function FancyDate({
    date,
}: {
    date: Date;
}) {
    return (
        <Text
            onPress={() => {
                showToast(
                    moment(date).toLocaleString(),
                    getAssetIDByName("ic_clock")
                );
            }}
            onLongPress={() => {
                clipboard.setString(
                    date.getTime().toString()
                );

                showToast(
                    "Copied Timestamp to Clipboard",
                    getAssetIDByName(
                        "ic_message_copy"
                    )
                );
            }}
            style={MessageStyles.highlight}
        >
            {moment(date).fromNow()}
        </Text>
    );
}

const { Text } = findByProps(
    "Text",
    "View"
);

export default function AlertContent({
    channel,
}: {
    channel: any;
}) {
    const creationDate = new Date(
        snowflakeUtils.extractTimestamp(
            channel.id
        )
    );

    const lastMessageDate =
        channel.lastMessageId
            ? new Date(
                  snowflakeUtils.extractTimestamp(
                      channel.lastMessageId
                  )
              )
            : null;

    const lastPinDate =
        channel.lastPinTimestamp
            ? new Date(
                  channel.lastPinTimestamp
              )
            : null;

    return (
        <>
            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                Topic:
            </Text>

            <Text style={MessageStyles.text}>
                {channel.topic ||
                    "No topic."}
            </Text>

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}
                Creation date:
            </Text>

            <FancyDate
                date={creationDate}
            />

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}
                Last message:
            </Text>

            {lastMessageDate ? (
                <FancyDate
                    date={lastMessageDate}
                />
            ) : (
                <Text
                    style={MessageStyles.text}
                >
                    No messages.
                </Text>
            )}

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}
                Last pin:
            </Text>

            {lastPinDate ? (
                <FancyDate
                    date={lastPinDate}
                />
            ) : (
                <Text
                    style={MessageStyles.text}
                >
                    No pins.
                </Text>
            )}
        </>
    );
}
