import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetadataPublisher } from "./MetadataPublisher";
import { buildMemberDocument, metadataSha256 } from "@/lib/metadata/publish";

const cid = "bafkreid7qoywk77r7rj3slobqfekdvs57qwuwh5d2z3sqsw52iabe3mqne";

afterEach(() => vi.restoreAllMocks());

describe("MetadataPublisher", () => {
  it("keeps the preview on failure and retries the same bytes", async () => {
    const document = buildMemberDocument({ name: "Member", description: "Voting member", image: "" });
    const hash = await metadataSha256(document.json);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Pin failed" }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ uri: `ipfs://${cid}`, sha256: hash }), { status: 200 }));
    const onUploaded = vi.fn();
    render(<MetadataPublisher label="Publish member" build={() => [document]} onUploaded={onUploaded} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview metadata" }));
    expect(await screen.findByText(document.json)).toBeInTheDocument();
    expect(screen.getByText(`SHA-256: ${hash}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pin preview to IPFS" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pin failed");
    expect(screen.getByText(document.json)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pin preview to IPFS" }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith([`ipfs://${cid}`]));
    expect(screen.getByRole("status")).toHaveTextContent(`ipfs://${cid}`);
    expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1]?.body as string).json)).toEqual([document.json, document.json]);
  });

  it("does not apply an upload after the source fields change", async () => {
    const oldDocument = buildMemberDocument({ name: "Old", description: "Voting", image: "" });
    const newDocument = buildMemberDocument({ name: "New", description: "Voting", image: "" });
    let finishUpload!: (response: Response) => void;
    const upload = new Promise<Response>((resolve) => { finishUpload = resolve; });
    vi.spyOn(globalThis, "fetch").mockReturnValue(upload);
    const onUploaded = vi.fn();
    const { rerender } = render(
      <MetadataPublisher key="old" label="Publish member" build={() => [oldDocument]} onUploaded={onUploaded} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview metadata" }));
    await screen.findByText(oldDocument.json);
    fireEvent.click(screen.getByRole("button", { name: "Pin preview to IPFS" }));
    rerender(<MetadataPublisher key="new" label="Publish member" build={() => [newDocument]} onUploaded={onUploaded} />);
    await act(async () => {
      finishUpload(new Response(JSON.stringify({
        uri: `ipfs://${cid}`, sha256: await metadataSha256(oldDocument.json),
      }), { status: 200 }));
      await upload;
    });
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.queryByText(oldDocument.json)).not.toBeInTheDocument();
  });
});
