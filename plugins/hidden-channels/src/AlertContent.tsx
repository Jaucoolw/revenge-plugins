import { stylesheet, constants, moment, clipboard } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { semanticColors } from "@vendetta/ui";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

const { Text } = findByProps("Button", "Text", "View");

const snowflakeUtils = findByProps("extractTimestamp");

const MessageStyles = stylesheet.createThemedStyleSheet({
    text: {
        fontSize: 16,
        color: semanticColors.HEADER_PRIMARY,
    },

    bold: {
        fontFamily: constants.Fonts.PRIMARY_SEMIBOLD,
    },

    highlight: {
        backgroundColor:
            semanticColors.BACKGROUND_MESSAGE_HIGHLIGHT_HOVER,
    },
});

function FancyDate({ date }) {
    return (
        <Text
            onPress={() => {
                showToast(
                    moment(date).toLocaleString(),
                    getAssetIDByName("ic_clock")
                );
            }}
            onLongPress={() => {
                clipboard.setString(date.getTime().toString());

                showToast(
                    "Copied Timestamp to Clipboard",
                    getAssetIDByName("ic_message_copy")
                );
            }}
            style={MessageStyles.highlight}
        >
            {moment(date).fromNow()}
        </Text>
    );
}

export default function AlertContent({ channel }) {
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
                {channel.topic || "No topic."}
            </Text>

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}Creation date:
            </Text>

            <FancyDate
                date={
                    new Date(
                        snowflakeUtils.extractTimestamp(
                            channel.id
                        )
                    )
                }
            />

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}Last message:
            </Text>

            {channel.lastMessageId ? (
                <FancyDate
                    date={
                        new Date(
                            snowflakeUtils.extractTimestamp(
                                channel.lastMessageId
                            )
                        )
                    }
                />
            ) : (
                <Text style={MessageStyles.text}>
                    No messages.
                </Text>
            )}

            <Text
                style={[
                    MessageStyles.text,
                    MessageStyles.bold,
                ]}
            >
                {"\n\n"}Last pin:
            </Text>

            {channel.lastPinTimestamp ? (
                <FancyDate
                    date={new Date(channel.lastPinTimestamp)}
                />
            ) : (
                <Text style={MessageStyles.text}>
                    No pins.
                </Text>
            )}
        </>
    );
}
